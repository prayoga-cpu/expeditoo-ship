import { stripe } from "@/lib/stripe";
import { db } from "@/db";
import { payments } from "@/db/schema/payments";
import { eq } from "drizzle-orm";
import { paymentsService } from "@/server/services/payments.service";

export const refundService = {
    /**
     * Process a full refund for a payment
     */
    async processRefund(paymentId: string, reason?: string) {
        const payment = await db.query.payments.findFirst({
            where: eq(payments.id, paymentId),
        });

        if (!payment) {
            throw new Error("Payment not found");
        }

        // An escalated job was charged in Expedion, into Expedion's Stripe
        // account (docs/specs/payment_at_booking_spec.md §6). This platform
        // holds a record of that money, not the money, so an operator must not
        // be able to issue a refund here that would never reach the client.
        if (payment.source === "expedion") {
            throw new Error(
                "Refund not local: this payment was taken in Expedion and must be refunded there"
            );
        }

        if (!payment.stripePaymentIntentId) {
            throw new Error("Payment does not have a Stripe Payment Intent ID");
        }

        if (payment.status === "refunded") {
            throw new Error("Payment is already refunded");
        }

        // Process refund via Stripe
        const refund = await stripe.refunds.create({
            payment_intent: payment.stripePaymentIntentId,
            reason:
                reason === "duplicate" ||
                    reason === "fraudulent" ||
                    reason === "requested_by_customer"
                    ? reason
                    : "requested_by_customer",
        });

        if (refund.status === "succeeded" || refund.status === "pending") {
            // Through the one transition, never with a bare UPDATE here. The
            // client now holds an invoice raised when the money was taken, so
            // giving it back has to raise the correction — and this route is
            // ungated on shipment status, which makes it the path most likely
            // to refund a delivered, invoiced job
            // (docs/specs/invoice_at_payment_spec.md §5).
            await paymentsService.markRefunded(paymentId);
        }

        return refund;
    },

    /**
     * Get refund details from Stripe
     */
    async getRefundDetails(refundId: string) {
        return await stripe.refunds.retrieve(refundId);
    },
};
