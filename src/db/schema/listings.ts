import {
  pgTable,
  text,
  timestamp,
  integer,
  pgEnum,
  doublePrecision,
  index,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { user } from "./users";

// ========================================
// Enums
// ========================================

export const listingConditionEnum = pgEnum("listing_condition", [
  "new",
  "used_like_new",
  "used_good",
  "used_fair",
]);

export const listingTypeEnum = pgEnum("listing_type", [
  "auction",
  "direct_sale",
]);

export const listingStatusEnum = pgEnum("listing_status", [
  "active",
  "sold",
  "ended",
  "cancelled",
]);

export const listingSizeEnum = pgEnum("listing_size", [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
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
  parentId: text("parent_id"), // Self-referencing for hierarchy
});

// ========================================
// Listings Table
// ========================================

export const listings = pgTable(
  "listings",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    sellerId: text("seller_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id),
    condition: listingConditionEnum("condition").notNull(),
    type: listingTypeEnum("type").notNull(),
    status: listingStatusEnum("status").default("active").notNull(),

    // Pricing
    startPrice: integer("start_price"), // For auctions
    buyNowPrice: integer("buy_now_price"), // For direct sale or auction buy-now
    currentPrice: integer("current_price"), // Caches the current highest bid or price

    // Dimensions
    length: doublePrecision("length"), // cm
    width: doublePrecision("width"), // cm
    height: doublePrecision("height"), // cm
    weight: text("weight"), // stored as text to match UI ranges (e.g. "0-5")
    size: listingSizeEnum("size"),

    // Location (JSON or separate columns)
    // Using separate columns for PostGIS potential later
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    address: text("address"),
    city: text("city"),

    // Metadata
    views: integer("views").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    endsAt: timestamp("ends_at"), // For auctions

    // Auction winner - set when auction closes
    winnerId: text("winner_id").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("listing_seller_idx").on(table.sellerId),
    index("listing_category_idx").on(table.categoryId),
    index("listing_status_idx").on(table.status),
    // Functional GIN index for PostgreSQL Full-Text Search
    // standard production approach to avoid manually managed generated columns in V1
    index("listing_search_idx").using(
      "gin",
      sql`to_tsvector('french', ${table.title} || ' ' || ${table.description})`
    ),
  ]
);

// ========================================
// Listing Images Table
// ========================================

export const listingImages = pgTable("listing_images", {
  id: text("id").primaryKey(),
  listingId: text("listing_id")
    .notNull()
    .references(() => listings.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  order: integer("order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
  seller: one(user, {
    fields: [listings.sellerId],
    references: [user.id],
  }),
  category: one(categories, {
    fields: [listings.categoryId],
    references: [categories.id],
  }),
  images: many(listingImages),
}));

export const listingImagesRelations = relations(listingImages, ({ one }) => ({
  listing: one(listings, {
    fields: [listingImages.listingId],
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

export type ListingImage = typeof listingImages.$inferSelect;
export type InsertListingImage = typeof listingImages.$inferInsert;
