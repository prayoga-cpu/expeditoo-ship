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

// ========================================
// Withdrawals — a driver asking for money already earned
// ========================================
//
// Every payment is captured into the platform's own Stripe account. The
// driver's 90% is real and owed, but it is not sent automatically: there is no
// Connect transfer on the payout path, and `carriers.stripe_account_id` — the
// column `executePayout` would need — is written by nothing.
//
// So the money moves the way it actually moves in the business: the driver asks
// for it, an operator approves, somebody makes the transfer, and the reference
// is recorded. This table is that conversation. The ledger it draws on is
// `payouts`, one row per delivered shipment, which is what the driver has
// earned rather than what has been sent.

export const withdrawalStatusEnum = pgEnum("withdrawal_status", [
  /** The driver has asked. Nothing has moved. */
  "requested",
  /** An operator said yes. The transfer has not been made yet. */
  "approved",
  /** The transfer is done and its reference is on the row. */
  "paid",
  /** Refused, with a reason the driver can read. */
  "rejected",
]);

export const withdrawals = pgTable(
  "withdrawals",
  {
    id: text("id").primaryKey(),

    /**
     * The user id, not `carriers.id` — `payouts.carrier_id` references the user
     * table too, and a withdrawal has to sum those rows.
     */
    carrierId: text("carrier_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    /**
     * Denormalised from the payouts claimed at request time, and deliberately
     * frozen. If a later delivery lands while this request is open it belongs to
     * the next withdrawal, not this one — a total that moved after an operator
     * approved it would be a different amount from the one they approved.
     */
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").default("eur").notNull(),

    status: withdrawalStatusEnum("status").default("requested").notNull(),

    /** The bank/Stripe reference of the transfer, once one has been made. */
    reference: text("reference"),
    /** Why it was refused. Shown to the driver, so it is written for them. */
    decisionNote: text("decision_note"),

    decidedBy: text("decided_by").references(() => user.id, {
      onDelete: "set null",
    }),
    decidedAt: timestamp("decided_at"),
    paidAt: timestamp("paid_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("withdrawal_carrier_idx").on(table.carrierId),
    index("withdrawal_status_idx").on(table.status),
  ]
);

export const withdrawalsRelations = relations(withdrawals, ({ one }) => ({
  carrier: one(user, {
    fields: [withdrawals.carrierId],
    references: [user.id],
  }),
}));

export type Withdrawal = typeof withdrawals.$inferSelect;
export type InsertWithdrawal = typeof withdrawals.$inferInsert;
