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
import { vehicles } from "./carriers";
import { offers, timeSlotEnum } from "./offers";
import { conversations } from "./messages";

// ========================================
// Thread Offer Status Enum
// ========================================
// The standalone lane's own lifecycle. On the job lane the truth is
// `offers.status`, read through `offerId` - this column then only records what
// the chat did, and the card renders the joined offer instead.
// See docs/specs/thread_offer_spec.md §1.1.

export const threadOfferStatusEnum = pgEnum("thread_offer_status", [
  "pending",
  "accepted",
  "declined",
  "withdrawn",
]);

// ========================================
// Thread Offers Table
// ========================================
/**
 * A formal price put on the table inside a conversation.
 *
 * Two lanes share this row. When the thread is about an open job, `offerId`
 * points at a real `offers` row created in the same call, so the chat feeds the
 * existing reverse auction rather than shadowing it. When it is not - the
 * "Aucune annonce" thread the client screenshotted - the row stands alone and
 * moves no money.
 *
 * Exactly **one** pickup slot, never the twelve `SubmitOfferForm` allows. That
 * is what makes accepting inside the bubble safe: `offersService.acceptOffer`
 * takes no `slotId` for a one-slot offer, so there is no wrong slot to book.
 * See docs/specs/thread_offer_spec.md §1.2.
 */
export const threadOffers = pgTable(
  "thread_offers",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: text("sender_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    priceCents: integer("price_cents").notNull(),

    // What the sender said: a day with no timezone and a time of day, stored
    // beside the resolved instants because it renders identically wherever it
    // is read. The same pairing offer_slots uses.
    pickupDay: text("pickup_day").notNull(),
    pickupSlot: timeSlotEnum("pickup_slot").notNull(),
    deliveryLeadDays: integer("delivery_lead_days").default(0).notNull(),
    tzOffset: integer("tz_offset").default(0).notNull(),

    pickupAt: timestamp("pickup_at").notNull(),
    deliveryAt: timestamp("delivery_at").notNull(),

    note: text("note"),

    vehicleId: text("vehicle_id").references(() => vehicles.id, {
      onDelete: "set null",
    }),

    /**
     * The real bid this offer became, on the job lane.
     *
     * SET NULL rather than cascade: deleting a listing cascades its offers, and
     * the conversation must keep the card rather than silently lose a turn.
     */
    offerId: text("offer_id").references(() => offers.id, {
      onDelete: "set null",
    }),

    status: threadOfferStatusEnum("status").default("pending").notNull(),
    respondedAt: timestamp("responded_at"),
    respondedBy: text("responded_by").references(() => user.id, {
      onDelete: "set null",
    }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("thread_offer_conversation_idx").on(table.conversationId),
    // One live offer per sender per thread. Mirrors offer_one_live_per_carrier:
    // a chat invites haggling, and without this a sender can bury the thread in
    // competing prices with no way to tell which one still stands.
    uniqueIndex("thread_offer_one_live_per_sender")
      .on(table.conversationId, table.senderId)
      .where(sql`${table.status} = 'pending'`),
  ]
);

// ========================================
// Relations
// ========================================

export const threadOffersRelations = relations(threadOffers, ({ one }) => ({
  conversation: one(conversations, {
    fields: [threadOffers.conversationId],
    references: [conversations.id],
  }),
  sender: one(user, {
    fields: [threadOffers.senderId],
    references: [user.id],
  }),
  vehicle: one(vehicles, {
    fields: [threadOffers.vehicleId],
    references: [vehicles.id],
  }),
  offer: one(offers, {
    fields: [threadOffers.offerId],
    references: [offers.id],
  }),
}));

// ========================================
// Type Exports
// ========================================

export type ThreadOffer = typeof threadOffers.$inferSelect;
export type InsertThreadOffer = typeof threadOffers.$inferInsert;
export type ThreadOfferStatus =
  (typeof threadOfferStatusEnum.enumValues)[number];
