import {
  pgTable,
  text,
  timestamp,
  integer,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./users";
import { listings } from "./listings";
import { shipments } from "./shipments";

// ========================================
// Enums
// ========================================
// Stripe holds and releases payment (ROADMAP.md §1): accepting an offer
// authorises a manual-capture PaymentIntent, and the money is only captured on
// delivery. "released" is an authorisation cancelled without ever capturing.

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "authorising",
  "authorised",
  "captured",
  "failed",
  "refunded",
  "released",
]);

// ========================================
// Payments Table (Stripe)
// ========================================

export const payments = pgTable(
  "payments",
  {
    id: text("id").primaryKey(),
    // The shipper who pays.
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    stripePaymentIntentId: text("stripe_payment_intent_id").unique(),
    stripeCheckoutSessionId: text("stripe_checkout_session_id").unique(),

    amountCents: integer("amount_cents").notNull(),
    // 10% commission on each completed delivery (ROADMAP.md §1), held at source.
    commissionCents: integer("commission_cents").notNull(),
    currency: text("currency").default("eur").notNull(),
    status: paymentStatusEnum("status").default("pending").notNull(),

    transferGroup: text("transfer_group"),
    failureReason: text("failure_reason"),

    // Context
    listingId: text("listing_id").references(() => listings.id, {
      onDelete: "set null",
    }),
    shipmentId: text("shipment_id").references(() => shipments.id, {
      onDelete: "set null",
    }),

    authorisedAt: timestamp("authorised_at"),
    capturedAt: timestamp("captured_at"),
    refundedAt: timestamp("refunded_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("payment_user_idx").on(table.userId),
    index("payment_stripe_pi_idx").on(table.stripePaymentIntentId),
    index("payment_shipment_idx").on(table.shipmentId),
    index("payment_status_idx").on(table.status),
  ]
);

// ========================================
// Payouts Table
// ========================================
// The carrier side of the money. Phase A records the intent; the actual
// Stripe Connect transfer is Phase C (ROADMAP.md §8).

export const payoutStatusEnum = pgEnum("payout_status", [
  "scheduled",
  "processing",
  "paid",
  "failed",
  "cancelled",
]);

export const payouts = pgTable(
  "payouts",
  {
    id: text("id").primaryKey(),
    // The carrier being paid.
    carrierId: text("carrier_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    shipmentId: text("shipment_id")
      .notNull()
      .references(() => shipments.id, { onDelete: "cascade" }),
    paymentId: text("payment_id").references(() => payments.id, {
      onDelete: "set null",
    }),

    // What the carrier receives: payment.amountCents - payment.commissionCents.
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").default("eur").notNull(),
    status: payoutStatusEnum("status").default("scheduled").notNull(),

    stripeTransferId: text("stripe_transfer_id"),
    failureReason: text("failure_reason"),

    scheduledFor: timestamp("scheduled_for"),
    paidAt: timestamp("paid_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("payout_carrier_idx").on(table.carrierId),
    index("payout_shipment_idx").on(table.shipmentId),
    index("payout_status_idx").on(table.status),
  ]
);

// ========================================
// Relations
// ========================================

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  user: one(user, {
    fields: [payments.userId],
    references: [user.id],
  }),
  listing: one(listings, {
    fields: [payments.listingId],
    references: [listings.id],
  }),
  shipment: one(shipments, {
    fields: [payments.shipmentId],
    references: [shipments.id],
  }),
  payouts: many(payouts),
}));

export const payoutsRelations = relations(payouts, ({ one }) => ({
  carrier: one(user, {
    fields: [payouts.carrierId],
    references: [user.id],
  }),
  shipment: one(shipments, {
    fields: [payouts.shipmentId],
    references: [shipments.id],
  }),
  payment: one(payments, {
    fields: [payouts.paymentId],
    references: [payments.id],
  }),
}));

// ========================================
// Type Exports
// ========================================

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;
export type PaymentStatus = (typeof paymentStatusEnum.enumValues)[number];

export type Payout = typeof payouts.$inferSelect;
export type InsertPayout = typeof payouts.$inferInsert;
export type PayoutStatus = (typeof payoutStatusEnum.enumValues)[number];
