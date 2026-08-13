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
import { payments } from "./payments";

// ========================================
// Enums
// ========================================

export const invoiceStatusEnum = pgEnum("invoice_status", [
    "draft",
    "issued",
    "paid",
    "void",
]);

// ========================================
// Invoices Table
// ========================================

export const invoices = pgTable(
    "invoices",
    {
        id: text("id").primaryKey(),

        // Reference to payment
        paymentId: text("payment_id")
            .notNull()
            .references(() => payments.id, { onDelete: "cascade" }),

        // User who owns this invoice (buyer)
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),

        // Invoice number for display (e.g., INV-2024-0001)
        invoiceNumber: text("invoice_number").notNull().unique(),

        // Amount in cents
        amount: integer("amount").notNull(),
        currency: text("currency").default("EUR").notNull(),

        // Status
        status: invoiceStatusEnum("status").default("draft").notNull(),

        // Dates
        issuedAt: timestamp("issued_at"),
        dueAt: timestamp("due_at"),
        paidAt: timestamp("paid_at"),

        // PDF storage
        pdfUrl: text("pdf_url"),

        // Metadata
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at")
            .defaultNow()
            .$onUpdate(() => new Date())
            .notNull(),
    },
    (table) => [
        index("invoice_payment_idx").on(table.paymentId),
        index("invoice_user_idx").on(table.userId),
        index("invoice_status_idx").on(table.status),
        index("invoice_number_idx").on(table.invoiceNumber),
    ]
);

// ========================================
// Relations
// ========================================

export const invoicesRelations = relations(invoices, ({ one }) => ({
    payment: one(payments, {
        fields: [invoices.paymentId],
        references: [payments.id],
    }),
    user: one(user, {
        fields: [invoices.userId],
        references: [user.id],
    }),
}));

// ========================================
// Type Exports
// ========================================

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;
export type InvoiceStatus = "draft" | "issued" | "paid" | "void";
