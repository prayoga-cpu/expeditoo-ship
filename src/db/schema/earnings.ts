import {
  pgTable,
  text,
  timestamp,
  integer,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { user } from "./users";
import { orders } from "./orders";

// ========================================
// Enums
// ========================================

export const earningSourceEnum = pgEnum("earning_source", [
  "sale", // From selling items at auction
  "delivery", // From delivering items as driver
  "app_fee", // Platform commission
]);

export const earningStatusEnum = pgEnum("earning_status", [
  "pending", // Transfer initiated
  "completed", // Transfer successful
  "failed", // Transfer failed
]);

// ========================================
// Earnings Table
// ========================================

export const earnings = pgTable(
  "earnings",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),

    // Who earned this
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Related order (optional - app_fee might not have specific order)
    orderId: text("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),

    // Amount in cents
    amount: integer("amount").notNull(),
    currency: text("currency").default("eur").notNull(),

    // Type of earning
    source: earningSourceEnum("source").notNull(),

    // Status tracking
    status: earningStatusEnum("status").default("completed").notNull(),

    // Stripe transfer reference (for reconciliation)
    stripeTransferId: text("stripe_transfer_id"),

    // Human readable description
    description: text("description"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("earning_user_idx").on(table.userId),
    index("earning_order_idx").on(table.orderId),
    index("earning_source_idx").on(table.source),
    index("earning_created_idx").on(table.createdAt),
  ]
);

// ========================================
// Relations
// ========================================

export const earningsRelations = relations(earnings, ({ one }) => ({
  user: one(user, {
    fields: [earnings.userId],
    references: [user.id],
  }),
  order: one(orders, {
    fields: [earnings.orderId],
    references: [orders.id],
  }),
}));

// ========================================
// Type Exports
// ========================================

export type Earning = typeof earnings.$inferSelect;
export type InsertEarning = typeof earnings.$inferInsert;
export type EarningSourceType = (typeof earningSourceEnum.enumValues)[number];
export type EarningStatusType = (typeof earningStatusEnum.enumValues)[number];
