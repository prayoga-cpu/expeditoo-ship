import { stripe } from "@/lib/stripe";
import { db } from "@/db";
import { payments } from "@/db/schema/payments";
import { eq } from "drizzle-orm";

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
            // Update database
            await db
                .update(payments)
                .set({ status: "refunded", updatedAt: new Date() })
                .where(eq(payments.id, paymentId));
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
