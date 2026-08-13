import { db } from "@/db";
import { invoices, type InsertInvoice, type InvoiceStatus } from "@/db/schema/invoices";
import { eq, desc, and, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

// ========================================
// Helper: Generate invoice number
// ========================================

async function generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;

    // Get the count of invoices this year
    const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(invoices)
        .where(sql`invoice_number LIKE ${prefix + '%'}`);

    const count = Number(result[0]?.count) || 0;
    const sequence = String(count + 1).padStart(4, '0');

    return `${prefix}${sequence}`;
}

// ========================================
// Invoice DAL Functions
// ========================================

export const invoicesDal = {
    /**
     * Create a new invoice
     */
    async create(data: Omit<InsertInvoice, "id" | "invoiceNumber" | "createdAt" | "updatedAt">) {
        const invoiceNumber = await generateInvoiceNumber();

        const [invoice] = await db
            .insert(invoices)
            .values({
                id: nanoid(),
                invoiceNumber,
                ...data,
                status: "issued",
                issuedAt: new Date(),
            })
            .returning();

        return invoice;
    },

    /**
     * Get invoice by ID
     */
    async getById(id: string) {
        return db.query.invoices.findFirst({
            where: eq(invoices.id, id),
            with: {
                payment: true,
                user: true,
            },
        });
    },

    /**
     * Get invoice by payment ID
     */
    async getByPaymentId(paymentId: string) {
        return db.query.invoices.findFirst({
            where: eq(invoices.paymentId, paymentId),
            with: {
                payment: true,
                user: true,
            },
        });
    },

    /**
     * Get all invoices for a user with pagination
     */
    async getByUserId(
        userId: string,
        options: { page?: number; limit?: number; status?: InvoiceStatus } = {}
    ) {
        const { page = 1, limit = 20, status } = options;
        const offset = (page - 1) * limit;

        const whereConditions = [eq(invoices.userId, userId)];
        if (status) {
            whereConditions.push(eq(invoices.status, status));
        }

        const items = await db.query.invoices.findMany({
            where: and(...whereConditions),
            with: {
                payment: true,
            },
            orderBy: desc(invoices.createdAt),
            limit,
            offset,
        });

        const [countResult] = await db
            .select({ count: sql<number>`count(*)` })
            .from(invoices)
            .where(and(...whereConditions));

        const total = Number(countResult?.count) || 0;

        return {
            items,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    },

    /**
     * Update invoice
     */
    async update(id: string, data: Partial<Omit<InsertInvoice, "id" | "invoiceNumber">>) {
        const [updated] = await db
            .update(invoices)
            .set({
                ...data,
                updatedAt: new Date(),
            })
            .where(eq(invoices.id, id))
            .returning();

        return updated;
    },

    /**
     * Mark invoice as paid
     */
    async markAsPaid(id: string) {
        return this.update(id, {
            status: "paid",
            paidAt: new Date(),
        });
    },

    /**
     * Update PDF URL
     */
    async updatePdfUrl(id: string, pdfUrl: string) {
        return this.update(id, { pdfUrl });
    },
};
