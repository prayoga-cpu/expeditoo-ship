import {
  pgTable,
  text,
  timestamp,
  integer,
  pgEnum,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { TIME_SLOTS } from "@/lib/availability-window";
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
// Time Slot Enum
// ========================================
// Derived from TIME_SLOTS rather than restated, so the board filter and an
// offer's proposal cannot drift apart (CLAUDE.md gotcha 8).

export const timeSlotEnum = pgEnum("time_slot", TIME_SLOTS);

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

    /**
     * The **booked** slot, not the proposal.
     *
     * While the offer is pending this is the earliest slot the carrier
     * proposed; once awarded it is the one actually chosen. Keeping it here
     * rather than following `offer_slots` is what leaves `pickup_asc` sorting,
     * the shipment write and the Expedion write-back reading one pair of
     * columns, as they always have (offer_time_slots_spec.md §2).
     */
    estimatedPickup: timestamp("estimated_pickup").notNull(),
    estimatedDelivery: timestamp("estimated_delivery").notNull(),

    /** 0 = delivered the same day, 1 = J+1. See `deliveryInstant`. */
    deliveryLeadDays: integer("delivery_lead_days").default(0).notNull(),

    message: text("message"),

    status: offerStatusEnum("status").default("pending").notNull(),

    /**
     * True when the carrier took the job themselves rather than being chosen.
     *
     * Without it a self-taken award and an operator's decision are the same row,
     * and every number built on the award queue — how long a job waits, how
     * often an operator intervenes, what the auction actually saved — silently
     * starts counting one as the other. `expedion_quotes.assigned_directly`
     * exists for the same reason on the pool-assignment lane.
     */
    selfAccepted: boolean("self_accepted").default(false).notNull(),

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
// Offer Slots Table
// ========================================
// The carrier's answer to "when can you do it", given more than once. A child
// table rather than a JSON column because one of these rows is *booked* on
// award and has to be addressable by id from the accept request.

export const offerSlots = pgTable(
  "offer_slots",
  {
    id: text("id").primaryKey(),
    offerId: text("offer_id")
      .notNull()
      .references(() => offers.id, { onDelete: "cascade" }),

    // What the driver said: a day with no timezone and a time of day. Stored
    // beside the instants because it renders identically wherever it is read.
    day: text("day").notNull(),
    slot: timeSlotEnum("slot").notNull(),

    // What the server compares and schedules from - resolved once, at submit,
    // in the driver's timezone, so no later reader needs to know what it was.
    startsAt: timestamp("starts_at").notNull(),
    endsAt: timestamp("ends_at").notNull(),
    deliveryAt: timestamp("delivery_at").notNull(),
  },
  (table) => [
    index("offer_slot_offer_idx").on(table.offerId),
    uniqueIndex("offer_slot_unique").on(table.offerId, table.day, table.slot),
  ]
);

// ========================================
// Relations
// ========================================

export const offersRelations = relations(offers, ({ one, many }) => ({
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
  slots: many(offerSlots),
}));

export const offerSlotsRelations = relations(offerSlots, ({ one }) => ({
  offer: one(offers, {
    fields: [offerSlots.offerId],
    references: [offers.id],
  }),
}));

// ========================================
// Type Exports
// ========================================

export type Offer = typeof offers.$inferSelect;
export type InsertOffer = typeof offers.$inferInsert;

export type OfferSlot = typeof offerSlots.$inferSelect;
export type InsertOfferSlot = typeof offerSlots.$inferInsert;

export type OfferStatus = (typeof offerStatusEnum.enumValues)[number];
