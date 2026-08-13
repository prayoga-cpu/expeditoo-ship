import {
  pgTable,
  text,
  timestamp,
  integer,
  pgEnum,
  doublePrecision,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { user } from "./users";

// ========================================
// Enums
// ========================================
// A listing is a transport job, not an item for sale.
// See docs/specs/transport_listing_spec.md.

export const listingStatusEnum = pgEnum("listing_status", [
  "draft",
  "open",
  "awarded",
  "in_progress",
  "completed",
  "cancelled",
  "expired",
]);

// The 13 location types (ROADMAP.md §8 Phase A).
export const locationTypeEnum = pgEnum("location_type", [
  "house",
  "apartment",
  "warehouse",
  "factory",
  "construction_site",
  "shop",
  "office",
  "storage_unit",
  "farm",
  "port",
  "airport",
  "rail_terminal",
  "other",
]);

// Marks jobs escalated from Expedion. The bridge itself is Phase B; the column
// exists now because it is part of the target schema (ROADMAP.md §5).
export const listingOriginEnum = pgEnum("listing_origin", [
  "direct",
  "expedion",
]);

// ========================================
// Categories Table
// ========================================

export const categories = pgTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  image: text("image"),
  parentId: text("parent_id"),
});

// ========================================
// Listings Table (Transport Jobs)
// ========================================

export const listings = pgTable(
  "listings",
  {
    id: text("id").primaryKey(),
    shipperId: text("shipper_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id),
    status: listingStatusEnum("status").default("draft").notNull(),

    // ---- What ----
    title: text("title").notNull(),
    description: text("description").notNull(),
    weightKg: doublePrecision("weight_kg").notNull(),
    lengthCm: doublePrecision("length_cm"),
    widthCm: doublePrecision("width_cm"),
    heightCm: doublePrecision("height_cm"),
    quantity: integer("quantity").default(1).notNull(),
    isFragile: boolean("is_fragile").default(false).notNull(),
    needsHelp: boolean("needs_help").default(false).notNull(),

    // ---- Where: pickup ----
    pickupLat: doublePrecision("pickup_lat").notNull(),
    pickupLng: doublePrecision("pickup_lng").notNull(),
    pickupAddress: text("pickup_address").notNull(),
    pickupCity: text("pickup_city").notNull(),
    pickupPostalCode: text("pickup_postal_code").notNull(),
    pickupLocationType: locationTypeEnum("pickup_location_type").notNull(),
    pickupFloor: integer("pickup_floor"),
    pickupHasLift: boolean("pickup_has_lift"),

    // ---- Where: dropoff ----
    dropoffLat: doublePrecision("dropoff_lat").notNull(),
    dropoffLng: doublePrecision("dropoff_lng").notNull(),
    dropoffAddress: text("dropoff_address").notNull(),
    dropoffCity: text("dropoff_city").notNull(),
    dropoffPostalCode: text("dropoff_postal_code").notNull(),
    dropoffLocationType: locationTypeEnum("dropoff_location_type").notNull(),
    dropoffFloor: integer("dropoff_floor"),
    dropoffHasLift: boolean("dropoff_has_lift"),

    // ---- When ----
    pickupFrom: timestamp("pickup_from").notNull(),
    pickupUntil: timestamp("pickup_until").notNull(),
    dropoffFrom: timestamp("dropoff_from").notNull(),
    dropoffUntil: timestamp("dropoff_until").notNull(),
    isFlexible: boolean("is_flexible").default(false).notNull(),

    // ---- Money ----
    // The shipper's expectation, not a cap. Carriers may bid above it.
    budgetCents: integer("budget_cents").notNull(),
    // Set on acceptance. No FK to offers: that would be circular, and the
    // invariant is held by the accept transaction (offers_engine_spec.md §5).
    acceptedOfferId: text("accepted_offer_id"),

    // ---- Expedion bridge (Phase B) ----
    origin: listingOriginEnum("origin").default("direct").notNull(),
    externalRef: text("external_ref"),

    // ---- Metadata ----
    offersCount: integer("offers_count").default(0).notNull(),
    views: integer("views").default(0).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("listing_shipper_idx").on(table.shipperId),
    index("listing_category_idx").on(table.categoryId),
    index("listing_status_idx").on(table.status),
    index("listing_expires_idx").on(table.expiresAt),
    index("listing_origin_idx").on(table.origin),
    // Radius search over the pickup point.
    index("listing_pickup_geo_idx").on(table.pickupLat, table.pickupLng),
    // Functional GIN index for PostgreSQL Full-Text Search.
    index("listing_search_idx").using(
      "gin",
      sql`to_tsvector('french', ${table.title} || ' ' || ${table.description})`
    ),
  ]
);

// ========================================
// Photos Table
// ========================================
// Optional for a transport job - many are described in text alone.

export const photos = pgTable(
  "photos",
  {
    id: text("id").primaryKey(),
    listingId: text("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    order: integer("order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("photo_listing_idx").on(table.listingId)]
);

// ========================================
// Relations
// ========================================

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: "categoryHierarchy",
  }),
  children: many(categories, {
    relationName: "categoryHierarchy",
  }),
  listings: many(listings),
}));

export const listingsRelations = relations(listings, ({ one, many }) => ({
  shipper: one(user, {
    fields: [listings.shipperId],
    references: [user.id],
  }),
  category: one(categories, {
    fields: [listings.categoryId],
    references: [categories.id],
  }),
  photos: many(photos),
}));

export const photosRelations = relations(photos, ({ one }) => ({
  listing: one(listings, {
    fields: [photos.listingId],
    references: [listings.id],
  }),
}));

// ========================================
// Type Exports
// ========================================

export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;

export type Listing = typeof listings.$inferSelect;
export type InsertListing = typeof listings.$inferInsert;

export type Photo = typeof photos.$inferSelect;
export type InsertPhoto = typeof photos.$inferInsert;

export type ListingStatus = (typeof listingStatusEnum.enumValues)[number];
export type LocationType = (typeof locationTypeEnum.enumValues)[number];
export type ListingOrigin = (typeof listingOriginEnum.enumValues)[number];
