import { nanoid } from "nanoid";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import { payments, payouts } from "@/db/schema/payments";
import { stripe } from "@/lib/stripe";
import { carriersDal } from "@/server/dal/carriers.dal";

// ========================================
// Errors
// ========================================

export class PaymentError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message?: string
  ) {
    super(message ?? code);
    this.name = "PaymentError";
  }
}

const err = (code: string, status: number, message?: string) =>
  new PaymentError(code, status, message);

/** 10% commission on each completed delivery (ROADMAP.md §1). */
export const COMMISSION_RATE = 0.1;

export const commissionFor = (amountCents: number) =>
  Math.round(amountCents * COMMISSION_RATE);

// ========================================
// Service
// ========================================

export const paymentsService = {
  /**
   * Authorises, but does not take, the money when an offer is accepted.
   *
   * Manual capture is the whole point: the shipper's card is held so the
   * carrier knows the job is funded, and the funds only move once the goods
   * are delivered (ROADMAP.md §1, "Stripe holds and releases payment").
   */
  async authoriseForShipment(params: {
    shipperId: string;
    shipmentId: string;
    listingId: string;
    amountCents: number;
    stripeCustomerId: string | null;
    paymentMethodId?: string;
  }) {
    if (!params.stripeCustomerId) {
      throw err("PAYMENT_METHOD_REQUIRED", 402, "Add a payment method first");
    }

    const commissionCents = commissionFor(params.amountCents);
    const transferGroup = `shipment_${params.shipmentId}`;

    const [row] = await db
      .insert(payments)
      .values({
        id: nanoid(),
        userId: params.shipperId,
        amountCents: params.amountCents,
        commissionCents,
        currency: "eur",
        status: "authorising",
        transferGroup,
        listingId: params.listingId,
        shipmentId: params.shipmentId,
      })
      .returning();

    try {
      const intent = await stripe.paymentIntents.create({
        amount: params.amountCents,
        currency: "eur",
        customer: params.stripeCustomerId,
        payment_method: params.paymentMethodId,
        // Hold now, take on delivery.
        capture_method: "manual",
        confirm: Boolean(params.paymentMethodId),
        transfer_group: transferGroup,
        metadata: {
          shipmentId: params.shipmentId,
          listingId: params.listingId,
        },
      });

      const [updated] = await db
        .update(payments)
        .set({
          stripePaymentIntentId: intent.id,
          status: intent.status === "requires_capture" ? "authorised" : "pending",
          authorisedAt: intent.status === "requires_capture" ? new Date() : null,
        })
        .where(eq(payments.id, row.id))
        .returning();

      return {
        payment: updated,
        clientSecret: intent.client_secret,
        requiresAction: intent.status !== "requires_capture",
      };
    } catch (cause) {
      await db
        .update(payments)
        .set({
          status: "failed",
          failureReason: cause instanceof Error ? cause.message : "unknown",
        })
        .where(eq(payments.id, row.id));

      throw err(
        "PAYMENT_AUTHORISATION_FAILED",
        402,
        "Could not authorise payment"
      );
    }
  },

  /**
   * Captures the held funds on delivery and records what the carrier is owed.
   * The transfer itself is Phase C; Phase A records the obligation so nothing
   * is lost between delivery and payout.
   */
  async captureForShipment(shipmentId: string) {
    const payment = await db.query.payments.findFirst({
      where: eq(payments.shipmentId, shipmentId),
    });

    if (!payment) throw err("PAYMENT_NOT_FOUND", 404);
    // Capturing twice would double-charge, so an already-captured payment is
    // a no-op rather than an error.
    if (payment.status === "captured") return payment;
    if (payment.status !== "authorised") {
      throw err("PAYMENT_NOT_AUTHORISED", 409);
    }
    if (!payment.stripePaymentIntentId) {
      throw err("PAYMENT_INTENT_MISSING", 409);
    }

    await stripe.paymentIntents.capture(payment.stripePaymentIntentId);

    const [captured] = await db
      .update(payments)
      .set({ status: "captured", capturedAt: new Date() })
      .where(eq(payments.id, payment.id))
      .returning();

    return captured;
  },

  /**
   * Releases an authorisation without ever taking the money - used when an
   * awarded job is cancelled before delivery.
   */
  async releaseForShipment(shipmentId: string) {
    const payment = await db.query.payments.findFirst({
      where: eq(payments.shipmentId, shipmentId),
    });

    if (!payment) return null;
    if (payment.status === "released") return payment;
    if (payment.status === "captured") {
      throw err("PAYMENT_ALREADY_CAPTURED", 409, "Refund instead of release");
    }

    if (payment.stripePaymentIntentId) {
      await stripe.paymentIntents.cancel(payment.stripePaymentIntentId);
    }

    const [released] = await db
      .update(payments)
      .set({ status: "released" })
      .where(eq(payments.id, payment.id))
      .returning();

    return released;
  },

  /**
   * Records what the carrier has earned. Commission is held at source, so the
   * payout is the job price minus the platform's cut.
   */
  async schedulePayout(shipmentId: string, carrierId: string) {
    const payment = await db.query.payments.findFirst({
      where: eq(payments.shipmentId, shipmentId),
    });
    if (!payment) throw err("PAYMENT_NOT_FOUND", 404);

    const existing = await db.query.payouts.findFirst({
      where: eq(payouts.shipmentId, shipmentId),
    });
    if (existing) return existing;

    const [payout] = await db
      .insert(payouts)
      .values({
        id: nanoid(),
        carrierId,
        shipmentId,
        paymentId: payment.id,
        amountCents: payment.amountCents - payment.commissionCents,
        currency: payment.currency,
        status: "scheduled",
      })
      .returning();

    return payout;
  },

  /**
   * Moves a scheduled payout to the carrier's Connect account.
   * Phase C: called once Connect onboarding is live.
   */
  async executePayout(payoutId: string) {
    const payout = await db.query.payouts.findFirst({
      where: eq(payouts.id, payoutId),
    });
    if (!payout) throw err("PAYOUT_NOT_FOUND", 404);
    if (payout.status === "paid") return payout;

    const carrier = await carriersDal.getByUserId(payout.carrierId);
    if (!carrier?.stripeAccountId) {
      throw err("CARRIER_ACCOUNT_MISSING", 409);
    }

    const payment = payout.paymentId
      ? await db.query.payments.findFirst({
          where: eq(payments.id, payout.paymentId),
        })
      : null;

    try {
      const transfer = await stripe.transfers.create({
        amount: payout.amountCents,
        currency: payout.currency,
        destination: carrier.stripeAccountId,
        transfer_group: payment?.transferGroup ?? undefined,
        metadata: { shipmentId: payout.shipmentId, payoutId: payout.id },
      });

      const [paid] = await db
        .update(payouts)
        .set({
          status: "paid",
          stripeTransferId: transfer.id,
          paidAt: new Date(),
        })
        .where(eq(payouts.id, payout.id))
        .returning();

      return paid;
    } catch (cause) {
      await db
        .update(payouts)
        .set({
          status: "failed",
          failureReason: cause instanceof Error ? cause.message : "unknown",
        })
        .where(eq(payouts.id, payout.id));
      throw err("PAYOUT_FAILED", 502);
    }
  },

  async getForShipment(shipmentId: string) {
    return await db.query.payments.findFirst({
      where: eq(payments.shipmentId, shipmentId),
    });
  },

  async getCarrierPayouts(carrierId: string) {
    return await db.query.payouts.findMany({
      where: eq(payouts.carrierId, carrierId),
    });
  },
};
