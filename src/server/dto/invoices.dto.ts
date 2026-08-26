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

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type InvoiceQuery = z.infer<typeof invoiceQuerySchema>;
