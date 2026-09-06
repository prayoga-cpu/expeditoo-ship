import { db } from "@/db";
import { documentSequences } from "@/db/schema/document-sequences";
import {
    invoices,
    type InsertInvoice,
    type InvoiceKind,
    type InvoiceStatus,
} from "@/db/schema/invoices";
import { eq, desc, and, gte, lte, sql, type SQL } from "drizzle-orm";
import { nanoid } from "nanoid";

// ========================================
// Helper: allocate a document number
// ========================================

/** The prefix each kind of document is numbered under. */
const SERIES: Record<InvoiceKind, string> = {
    invoice: "INV",
    credit_note: "AV",
};

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Claims the next number in a series, atomically.
 *
 * This used to be `count(*) + 1` over rows matching the prefix, read in one
 * statement and inserted in another against a UNIQUE column: two documents
 * raised in the same second computed the same string and the loser got a
 * 23505. The count was also unrecoverable after a deletion — and both of
 * `invoices`' foreign keys cascade — because it re-derived a number that had
 * already been issued, on every attempt, forever.
 *
 * The counter row is the high-water mark and survives the rows it numbered.
 * Claimed inside the caller's transaction so the number and the document commit
 * together (docs/specs/invoice_at_payment_spec.md §6).
 */
async function nextDocumentNumber(
    tx: Tx,
    kind: InvoiceKind,
    year: number
): Promise<string> {
    const series = SERIES[kind];

    const [row] = await tx
        .insert(documentSequences)
        .values({ series, year, lastValue: 1 })
        .onConflictDoUpdate({
            target: [documentSequences.series, documentSequences.year],
            set: {
                lastValue: sql`${documentSequences.lastValue} + 1`,
                updatedAt: new Date(),
            },
        })
        .returning({ lastValue: documentSequences.lastValue });

    const sequence = String(row?.lastValue ?? 1).padStart(4, "0");

    return `${series}-${year}-${sequence}`;
}

// ========================================
// Invoice DAL Functions
// ========================================

/** Everything a caller may set; the number and the timestamps are ours. */
type CreateInvoiceData = Omit<
    InsertInvoice,
    "id" | "invoiceNumber" | "createdAt" | "updatedAt"
>;

export const invoicesDal = {
    /**
     * Create a document and claim its number in one transaction.
     *
     * `status` is a parameter rather than a constant: a document raised the
     * moment the money is taken is not "issued and awaiting payment", it is
     * settled. The old signature accepted a status and then overwrote it with
     * `"issued"` after the spread, so every caller was silently ignored.
     */
    async create(data: CreateInvoiceData) {
        const kind = data.kind ?? "invoice";
        const year = new Date().getFullYear();

        return db.transaction(async (tx) => {
            const invoiceNumber = await nextDocumentNumber(tx, kind, year);

            const [invoice] = await tx
                .insert(invoices)
                .values({
                    id: nanoid(),
                    invoiceNumber,
                    issuedAt: new Date(),
                    ...data,
                    status: data.status ?? "issued",
                    kind,
                })
                .returning();

            return invoice;
        });
    },

    /**
     * Get invoice by ID
     */
    async getById(id: string) {
        return db.query.invoices.findFirst({
            where: eq(invoices.id, id),
            with: {
                payment: { with: { listing: true } },
                user: true,
            },
        });
    },

    /**
     * Get invoice by payment ID
     */
    async getByPaymentId(paymentId: string) {
        return db.query.invoices.findFirst({
            where: and(
                eq(invoices.paymentId, paymentId),
                eq(invoices.kind, "invoice")
            ),
            with: {
                payment: { with: { listing: true } },
                user: true,
            },
        });
    },

    /**
     * The correction already raised against an invoice, if there is one.
     *
     * Keyed on the document rather than the payment so a re-award — which mints
     * a fresh payment for the same job — is not mistaken for a duplicate.
     */
    async getCreditNoteFor(invoiceId: string) {
        return db.query.invoices.findFirst({
            where: and(
                eq(invoices.relatedInvoiceId, invoiceId),
                eq(invoices.kind, "credit_note")
            ),
        });
    },

    /**
     * Get all invoices for a user with pagination
     */
    async getByUserId(
        userId: string,
        options: {
            page?: number;
            limit?: number;
            status?: InvoiceStatus;
            from?: Date;
            to?: Date;
        } = {}
    ) {
        const { page = 1, limit = 20, status, from, to } = options;
        const offset = (page - 1) * limit;

        const whereConditions: SQL[] = [eq(invoices.userId, userId)];
        if (status) {
            whereConditions.push(eq(invoices.status, status));
        }
        // Bounded on the issue date, falling back to creation for a row that
        // was never issued (billing_documents_spec.md §4.2).
        if (from) {
            whereConditions.push(
                gte(sql`coalesce(${invoices.issuedAt}, ${invoices.createdAt})`, from)
            );
        }
        if (to) {
            whereConditions.push(
                lte(sql`coalesce(${invoices.issuedAt}, ${invoices.createdAt})`, to)
            );
        }

        const items = await db.query.invoices.findMany({
            where: and(...whereConditions),
            with: {
                payment: { with: { listing: true } },
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
