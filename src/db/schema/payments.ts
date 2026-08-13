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

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "succeeded",
  "failed",
  "refunded",
]);

// ========================================
// Payments Table (Stripe)
// ========================================

export const payments = pgTable(
  "payments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    stripePaymentIntentId: text("stripe_payment_intent_id").unique(),
    stripeCheckoutSessionId: text("stripe_checkout_session_id").unique(),

    amount: integer("amount").notNull(),
    currency: text("currency").default("idr").notNull(),
    status: paymentStatusEnum("status").default("pending").notNull(),

    // Splits
    applicationFeeAmount: integer("application_fee_amount"),
    transferGroup: text("transfer_group"),

    // Context
    listingId: text("listing_id").references(() => listings.id, {
      onDelete: "set null",
    }),
    shipmentId: text("shipment_id").references(() => shipments.id, {
      onDelete: "set null",
    }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("payment_user_idx").on(table.userId),
    index("payment_stripe_pi_idx").on(table.stripePaymentIntentId),
  ]
);

// ========================================
// Relations
// ========================================

export const paymentsRelations = relations(payments, ({ one }) => ({
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
}));

// ========================================
// Type Exports
// ========================================

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;
