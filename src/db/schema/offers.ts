import {
  pgTable,
  text,
  timestamp,
  integer,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { user } from "./users";
import { listings } from "./listings";
import { vehicles } from "./carriers";

// ========================================
// Offer Status Enum
// ========================================
// accepted / rejected / expired are terminal. withdrawn is terminal for the
// row, but frees the carrier to submit a replacement.
// See docs/specs/offers_engine_spec.md §2.

export const offerStatusEnum = pgEnum("offer_status", [
  "pending",
  "accepted",
  "rejected",
  "withdrawn",
  "expired",
]);

// ========================================
// Offers Table
// ========================================
// A carrier's bid on a transport job. Carriers compete downward on price, but
// the shipper picks the winner - never the system, never lowest-price-wins.

export const offers = pgTable(
  "offers",
  {
    id: text("id").primaryKey(),
    listingId: text("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    carrierId: text("carrier_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // restrict: a vehicle backing a live offer must not vanish
    // (offers_engine_spec.md edge case 5).
    vehicleId: text("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "restrict" }),

    priceCents: integer("price_cents").notNull(),
    estimatedPickup: timestamp("estimated_pickup").notNull(),
    estimatedDelivery: timestamp("estimated_delivery").notNull(),
    message: text("message"),

    status: offerStatusEnum("status").default("pending").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("offer_listing_status_idx").on(table.listingId, table.status),
    index("offer_carrier_status_idx").on(table.carrierId, table.status),
    // Supports the shipper's default price_asc comparison.
    index("offer_listing_price_idx").on(table.listingId, table.priceCents),
    // One live offer per carrier per job. Withdrawing frees the slot for one
    // replacement, which is why withdrawn rows are excluded.
    uniqueIndex("offer_one_live_per_carrier")
      .on(table.listingId, table.carrierId)
      .where(sql`${table.status} <> 'withdrawn'`),
  ]
);

// ========================================
// Relations
// ========================================

export const offersRelations = relations(offers, ({ one }) => ({
  listing: one(listings, {
    fields: [offers.listingId],
    references: [listings.id],
  }),
  carrier: one(user, {
    fields: [offers.carrierId],
    references: [user.id],
  }),
  vehicle: one(vehicles, {
    fields: [offers.vehicleId],
    references: [vehicles.id],
  }),
}));

// ========================================
// Type Exports
// ========================================

export type Offer = typeof offers.$inferSelect;
export type InsertOffer = typeof offers.$inferInsert;

export type OfferStatus = (typeof offerStatusEnum.enumValues)[number];
