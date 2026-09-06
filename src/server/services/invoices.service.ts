import type { Invoice } from "@/db/schema/invoices";
import { addressesDal } from "@/server/dal/addresses.dal";
import { invoicesDal } from "@/server/dal/invoices.dal";
import { paymentsDal } from "@/server/dal/payments.dal";
import { getUserById } from "@/server/dal/users.dal";
import { type InvoiceQuery } from "@/server/dto/invoices.dto";
import { notificationsService } from "@/server/services/notifications.service";
import { invoiceDocumentEmail } from "@/server/services/invoice-email.service";

export class InvoiceError extends Error {
    constructor(
        readonly code: string,
        readonly status: number,
        message?: string
    ) {
        super(message ?? code);
        this.name = "InvoiceError";
    }
}

const err = (code: string, status: number, message?: string) =>
    new InvoiceError(code, status, message);

/** A bundle wider than this is refused rather than rendered. */
export const MAX_STATEMENT_INVOICES = 500;

/** The billed party and the prestation, as they stood when the money moved. */
async function billingSnapshot(userId: string, listingTitle?: string | null) {
    const [account, address] = await Promise.all([
        getUserById(userId),
        addressesDal.getDefaultByUserId(userId),
    ]);

    if (!account) throw err("INVOICE_USER_NOT_FOUND", 404);

    return {
        account,
        billingName: account.name || null,
        billingEmail: account.email || null,
        billingAddress: address
            ? [address.street, `${address.zip} ${address.city}`, address.country]
                  .filter(Boolean)
                  .join(", ")
            : null,
        lineDescription: listingTitle
            ? `Transport de marchandises — ${listingTitle}`
            : "Transport de marchandises",
    };
}

/** Whether this account asked not to be mailed about documents. */
const wantsEmail = (preferences: {
    notifications?: { email?: { invoiceReady?: boolean } };
} | null | undefined) => preferences?.notifications?.email?.invoiceReady !== false;

export const invoicesService = {
    /**
     * Raise the document for a payment that has been taken.
     *
     * Called from `paymentsService` the moment the charge settles — the client
     * pays at booking, so that is when they are owed a receipt — and still from
     * `settleDelivery` as a backstop for payments captured before this shipped
     * (docs/specs/invoice_at_payment_spec.md §1).
     *
     * Idempotent on the payment, and the database enforces it too: a partial
     * unique index on `payment_id` where `kind = 'invoice'`.
     */
    async createFromPayment(paymentId: string) {
        const payment = await paymentsDal.getById(paymentId);
        if (!payment) throw err("PAYMENT_NOT_FOUND", 404);

        const existing = await invoicesDal.getByPaymentId(paymentId);
        if (existing) return existing;

        // Two payments are deliberately not documented, and neither is an
        // error — both are ordinary states this is asked about on every
        // delivery, so they return rather than throw:
        //
        //  - money that never arrived. A failed or refunded charge has nothing
        //    to receipt.
        //  - money Expedion took. That client was invoiced in the app that
        //    debited them; §3 of the spec is the whole argument.
        if (payment.status !== "captured" || payment.source !== "stripe") {
            return null;
        }

        const snapshot = await billingSnapshot(
            payment.userId,
            payment.listing?.title
        );

        const invoice = await invoicesDal.create({
            paymentId: payment.id,
            userId: payment.userId,
            amount: payment.amountCents,
            currency: payment.currency,
            // The money is already taken, so the document is settled the moment
            // it exists. `issued` would describe a receivable that is not one.
            status: "paid",
            paidAt: payment.capturedAt ?? new Date(),
            billingName: snapshot.billingName,
            billingEmail: snapshot.billingEmail,
            billingAddress: snapshot.billingAddress,
            lineDescription: snapshot.lineDescription,
        });

        await this.announce(invoice, snapshot.account.preferences);

        return invoice;
    },

    /**
     * Correct an invoice whose money has been given back.
     *
     * Raised from the one `captured → refunded` transition, so both refund
     * writers reach it. An issued, numbered, emailed document is corrected by a
     * second document — never by mutating the first (§5).
     */
    async createCreditNoteForPayment(paymentId: string) {
        const invoice = await invoicesDal.getByPaymentId(paymentId);
        if (!invoice) return null;

        const existing = await invoicesDal.getCreditNoteFor(invoice.id);
        if (existing) return existing;

        const creditNote = await invoicesDal.create({
            paymentId: invoice.paymentId,
            userId: invoice.userId,
            kind: "credit_note",
            relatedInvoiceId: invoice.id,
            // The number too, not just the id: the document has to name the
            // facture it corrects on its own face, and it is emailed, so it may
            // not depend on a join that could later resolve differently.
            relatedInvoiceNumber: invoice.invoiceNumber,
            amount: -Math.abs(invoice.amount),
            currency: invoice.currency,
            status: "paid",
            paidAt: new Date(),
            billingName: invoice.billingName,
            billingEmail: invoice.billingEmail,
            billingAddress: invoice.billingAddress,
            lineDescription: invoice.lineDescription,
        });

        const account = await getUserById(invoice.userId);
        await this.announce(creditNote, account?.preferences);

        return creditNote;
    },

    /**
     * Tell the client the document exists, in the app and in their inbox.
     *
     * Never throws: the document is written and downloadable either way, and a
     * Resend outage must not roll back a charge.
     */
    async announce(
        invoice: Invoice,
        preferences?: { notifications?: { email?: { invoiceReady?: boolean } } } | null
    ) {
        const isCreditNote = invoice.kind === "credit_note";
        const amount = Math.abs(invoice.amount) / 100;

        await notificationsService
            .createNotification({
                userId: invoice.userId,
                type: "payment",
                title: isCreditNote ? "Avoir disponible" : "Votre reçu est disponible",
                message: `${invoice.invoiceNumber} — ${amount.toFixed(2)} €`,
                linkUrl: "/profile/invoices",
                data: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber },
            })
            .catch((error) =>
                console.error(`Invoice notification failed for ${invoice.id}`, error)
            );

        if (!wantsEmail(preferences)) return;

        await this.sendDocumentEmail(invoice.id).catch((error) =>
            console.error(`Invoice email failed for ${invoice.id}`, error)
        );
    },

    /**
     * The one row read a caller is allowed to have, with the ownership question
     * answered here rather than in the route (docs/rules.md §8).
     */
    async getOwnedInvoice(invoiceId: string, userId: string) {
        const invoice = await invoicesDal.getById(invoiceId);
        if (!invoice) throw err("INVOICE_NOT_FOUND", 404);
        if (invoice.userId !== userId) throw err("INVOICE_NOT_YOURS", 403);

        return invoice;
    },

    /**
     * Get invoice by ID
     */
    async getById(invoiceId: string, userId?: string) {
        if (userId) return this.getOwnedInvoice(invoiceId, userId);

        return (await invoicesDal.getById(invoiceId)) ?? null;
    },

    /**
     * Get all invoices for a user
     */
    async getUserInvoices(userId: string, query: InvoiceQuery) {
        return invoicesDal.getByUserId(userId, {
            page: query.page,
            limit: query.limit,
            status: query.status,
            from: query.from,
            to: query.to,
        });
    },

    /**
     * Every invoice in a period, for the bulk download. Capped rather than
     * paginated: a PDF render is not something to hold open indefinitely
     * (billing_documents_spec.md §4.3).
     */
    async getPeriodInvoices(
        userId: string,
        period: { from?: Date; to?: Date }
    ) {
        const page = await invoicesDal.getByUserId(userId, {
            ...period,
            page: 1,
            limit: MAX_STATEMENT_INVOICES,
        });

        if (page.total > MAX_STATEMENT_INVOICES) {
            throw err(
                "STATEMENT_TOO_LARGE",
                400,
                `Narrow the period: ${page.total} invoices exceeds the ${MAX_STATEMENT_INVOICES} row limit`
            );
        }

        return page.items;
    },

    /**
     * Get payment history for a user (combines payments with invoices)
     */
    async getPaymentHistory(userId: string, page = 1, limit = 20) {
        const payments = await paymentsDal.getByUserId(userId, page, limit);

        // Enrich with invoice data
        const enrichedPayments = await Promise.all(
            payments.items.map(async (payment) => {
                const invoice = await invoicesDal.getByPaymentId(payment.id);
                return {
                    ...payment,
                    invoice: invoice
                        ? {
                            id: invoice.id,
                            invoiceNumber: invoice.invoiceNumber,
                            pdfUrl: invoice.pdfUrl,
                        }
                        : null,
                };
            })
        );

        return {
            items: enrichedPayments,
            total: payments.total,
            page: payments.page,
            limit: payments.limit,
            totalPages: payments.totalPages,
        };
    },

    /**
     * Generate PDF URL for an invoice
     * PDF is generated on-demand via the API route
     */
    async generatePdf(invoiceId: string): Promise<string> {
        const invoice = await invoicesDal.getById(invoiceId);
        if (!invoice) throw err("INVOICE_NOT_FOUND", 404);

        // PDF is generated on-demand via the API route
        const pdfUrl = `/api/user/invoices/${invoiceId}/pdf`;

        // Update the invoice with the PDF URL
        await invoicesDal.updatePdfUrl(invoiceId, pdfUrl);

        return pdfUrl;
    },

    /**
     * Send the document itself, attached, to the account it belongs to.
     *
     * Never to an address the caller supplies: an endpoint that mails a PDF
     * wherever it is told is an open relay with the platform's domain on it
     * (§7.2).
     */
    async sendDocumentEmail(invoiceId: string) {
        const invoice = await invoicesDal.getById(invoiceId);
        if (!invoice) throw err("INVOICE_NOT_FOUND", 404);

        const to = invoice.billingEmail || invoice.user?.email;
        if (!to) throw err("INVOICE_NO_RECIPIENT", 409);

        try {
            await invoiceDocumentEmail(invoice, to);
        } catch (cause) {
            console.error(`Invoice email failed for ${invoice.id}`, cause);
            throw err("INVOICE_EMAIL_FAILED", 502, "Could not send the document");
        }

        return { sentTo: to };
    },
};
