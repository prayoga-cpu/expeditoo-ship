import { z } from "zod";

// ========================================
// Invoice DTO
// ========================================

export const invoiceStatusSchema = z.enum(["draft", "issued", "paid", "void"]);

export const createInvoiceSchema = z.object({
    paymentId: z.string().min(1, "Payment ID is required"),
    userId: z.string().min(1, "User ID is required"),
    amount: z.number().int().positive("Amount must be positive"),
    currency: z.string().default("EUR"),
});

export const updateInvoiceSchema = z.object({
    status: invoiceStatusSchema.optional(),
    pdfUrl: z.string().url().optional(),
    issuedAt: z.date().optional(),
    paidAt: z.date().optional(),
});

export const invoiceQuerySchema = z
    .object({
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().positive().max(50).default(20),
        status: invoiceStatusSchema.optional(),
        // The Cocolis period filter. Both bounds optional: "toutes périodes"
        // is the default (billing_documents_spec.md §4.2).
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
    })
    .refine((q) => !q.from || !q.to || q.from <= q.to, {
        path: ["to"],
        message: "INVALID_PERIOD",
    });

// ========================================
// Output — GET /api/user/invoices
// ========================================

/**
 * What the document calls itself on its face: *Facture*, *Reçu de paiement*
 * or *Avoir* (invoice_at_payment_spec.md §4.1). Decided by
 * `invoiceDocumentType` in `src/lib/invoice-pdf-props.ts`, the rule the PDF
 * title follows, so the list and the download cannot disagree.
 */
export const invoiceDocumentTypeSchema = z.enum(["invoice", "receipt", "credit_note"]);

/**
 * One row of the requester's transaction history.
 *
 * The DAL row arrives with its payment and that payment's listing joined;
 * neither leaves the server. Parsing strips them, so a column added to either
 * table later stays private until it is named here.
 */
export const userInvoiceViewSchema = z.object({
    id: z.string(),
    invoiceNumber: z.string(),
    paymentId: z.string(),
    userId: z.string(),
    amount: z.number().int(),
    currency: z.string(),
    status: invoiceStatusSchema,
    kind: z.enum(["invoice", "credit_note"]),
    documentType: invoiceDocumentTypeSchema,
    relatedInvoiceId: z.string().nullable(),
    relatedInvoiceNumber: z.string().nullable(),
    issuedAt: z.date().nullable(),
    dueAt: z.date().nullable(),
    paidAt: z.date().nullable(),
    pdfUrl: z.string().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
});

export const userInvoiceListSchema = z.object({
    items: z.array(userInvoiceViewSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    totalPages: z.number().int().nonnegative(),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type InvoiceQuery = z.infer<typeof invoiceQuerySchema>;
export type InvoiceDocumentType = z.infer<typeof invoiceDocumentTypeSchema>;
export type UserInvoiceView = z.infer<typeof userInvoiceViewSchema>;
export type UserInvoiceList = z.infer<typeof userInvoiceListSchema>;
