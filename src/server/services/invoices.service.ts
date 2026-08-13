import { invoicesDal } from "@/server/dal/invoices.dal";
import { paymentsDal } from "@/server/dal/payments.dal";
import { getUserById } from "@/server/dal/users.dal";
import { type InvoiceQuery } from "@/server/dto/invoices.dto";
import { notificationsService } from "@/server/services/notifications.service";
import { emailService } from "@/server/services/email.service";

export const invoicesService = {
    /**
     * Create an invoice for a completed payment
     * Called automatically after payment is confirmed
     */
    async createFromPayment(paymentId: string) {
        // Get the payment
        const payment = await paymentsDal.getById(paymentId);
        if (!payment) {
            throw new Error("Payment not found");
        }

        // Check if invoice already exists
        const existingInvoice = await invoicesDal.getByPaymentId(paymentId);
        if (existingInvoice) {
            return existingInvoice;
        }

        // Get user info
        const user = await getUserById(payment.userId);
        if (!user) {
            throw new Error("User not found");
        }

        // Create the invoice
        const invoice = await invoicesDal.create({
            paymentId: payment.id,
            userId: payment.userId,
            amount: payment.amountCents,
            currency: payment.currency,
        });

        // Create in-app notification
        await notificationsService.createNotification({
            userId: payment.userId,
            type: "PAYMENT",
            title: "Invoice Ready",
            message: `Your invoice ${invoice.invoiceNumber} is ready for download.`,
            data: {
                invoiceId: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                amount: invoice.amount,
            },
        });

        // Send email notification (if user has email preference enabled)
        const userPrefs = user.preferences;
        if (userPrefs?.notifications?.email?.invoiceReady !== false) {
            try {
                await this.sendInvoiceReadyEmail(invoice.id);
            } catch (error) {
                console.error("Failed to send invoice email:", error);
            }
        }

        return invoice;
    },

    /**
     * Get invoice by ID
     */
    async getById(invoiceId: string, userId?: string) {
        const invoice = await invoicesDal.getById(invoiceId);

        if (!invoice) {
            return null;
        }

        // If userId provided, verify ownership
        if (userId && invoice.userId !== userId) {
            throw new Error("Unauthorized access to invoice");
        }

        return invoice;
    },

    /**
     * Get all invoices for a user
     */
    async getUserInvoices(userId: string, query: InvoiceQuery) {
        return invoicesDal.getByUserId(userId, {
            page: query.page,
            limit: query.limit,
            status: query.status,
        });
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
        if (!invoice) {
            throw new Error("Invoice not found");
        }

        // PDF is generated on-demand via the API route
        const pdfUrl = `/api/user/invoices/${invoiceId}/pdf`;

        // Update the invoice with the PDF URL
        await invoicesDal.updatePdfUrl(invoiceId, pdfUrl);

        return pdfUrl;
    },

    /**
     * Send invoice ready email
     */
    async sendInvoiceReadyEmail(invoiceId: string) {
        const invoice = await invoicesDal.getById(invoiceId);
        if (!invoice || !invoice.user) {
            throw new Error("Invoice or user not found");
        }

        // Use a generic email for invoice ready notification
        // This would ideally be a dedicated InvoiceReadyEmail template
        await emailService.sendEmail({
            to: invoice.user.email,
            subject: `📄 Invoice ${invoice.invoiceNumber} Ready`,
            html: `
        <h1>Your invoice is ready</h1>
        <p>Hi ${invoice.user.name},</p>
        <p>Your invoice <strong>${invoice.invoiceNumber}</strong> for €${(invoice.amount / 100).toFixed(2)} is ready.</p>
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/profile/invoices">View your invoices</a></p>
      `,
        });
    },
};
