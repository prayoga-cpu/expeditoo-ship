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
    // Reserved. An issued, numbered, emailed document is corrected by a credit
    // note carrying its own number, never by annulling it after the fact -
    // `void` would only be defensible for a draft that never left the building,
    // and this codebase produces none (invoice_at_payment_spec.md 5).
    "void",
]);

/**
 * A document is either the claim or its correction.
 *
 * The invoice is now raised when the money is taken rather than when the goods
 * arrive, so it exists before every event that can give the money back. French
 * practice corrects an issued invoice with a *facture d'avoir* - a second
 * document, negative, referencing the first - which is why this is a kind of
 * row rather than a status on the original.
 */
export const invoiceKindEnum = pgEnum("invoice_kind", [
    "invoice",
    "credit_note",
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

        // The claim, or its correction. A credit note carries a negative
        // `amount` and points at what it corrects.
        kind: invoiceKindEnum("kind").default("invoice").notNull(),
        relatedInvoiceId: text("related_invoice_id"),
        // The corrected document's number, frozen here so an avoir names the
        // facture it corrects on its own face without a join.
        relatedInvoiceNumber: text("related_invoice_number"),

        // The billed party and the prestation, frozen at issue. The PDF used to
        // be rendered from live joins, so editing an account name rewrote a
        // document already sitting in somebody's inbox. Null on every row
        // issued before this shipped; the renderer falls back to the join.
        billingName: text("billing_name"),
        billingEmail: text("billing_email"),
        billingAddress: text("billing_address"),
        lineDescription: text("line_description"),

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
        index("invoice_related_idx").on(table.relatedInvoiceId),
        index("invoice_kind_idx").on(table.kind),
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
export type InvoiceKind = "invoice" | "credit_note";
