import { nanoid } from "nanoid";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import { payments, payouts, type PaymentSource } from "@/db/schema/payments";
import { user } from "@/db/schema/users";
import { stripe } from "@/lib/stripe";
import {
  MOCK_INTENT_PREFIX,
  isMockIntent,
  isMockPaymentsEnabled,
} from "@/lib/stripe/mock-payments";
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

/**
 * 10% commission on each completed delivery (ROADMAP.md §1).
 *
 * The other 90% is genuinely owed to the driver — it is simply not *sent*
 * automatically. Every payment is captured into the platform's own Stripe
 * account, and the driver's share accrues there as a balance they withdraw on
 * request: they ask, an operator approves, and the transfer is made by hand.
 * `withdrawals.service.ts` is that flow, and `payouts` is the ledger it draws
 * on — a payout row is what the driver has earned, not money already moved.
 *
 * This briefly read 1.0 on 2026-08-26 while the split was undecided. It is back
 * to 0.1 because the split *is* decided: the platform takes a tenth, the driver
 * is owed the rest, and the rest reaches them through withdrawal rather than
 * through Stripe Connect. Connect (`executePayout`) stays unused — it needs
 * `carriers.stripe_account_id`, which nothing writes.
 *
 * `payments` still records no rate per row, so a row's commission can only be
 * read back as an amount, not as a rate. That matters the day this number
 * changes again (ROADMAP.md §10).
 */
export const COMMISSION_RATE = 0.1;

export const commissionFor = (amountCents: number) =>
  Math.round(amountCents * COMMISSION_RATE);

// ========================================
// Helpers
// ========================================

type ChargeParams = {
  shipperId: string;
  shipmentId: string;
  listingId: string;
  amountCents: number;
  stripeCustomerId: string | null;
  source: PaymentSource;
};

/** The card an off-session charge will be put on, or null if there is none. */
async function firstSavedCard(customerId: string): Promise<string | null> {
  const methods = await stripe.paymentMethods.list({
    customer: customerId,
    type: "card",
  });
  return methods.data[0]?.id ?? null;
}

/** The row every branch below starts from: the attempt, before its outcome. */
function baseRow(params: ChargeParams) {
  return {
    id: nanoid(),
    userId: params.shipperId,
    amountCents: params.amountCents,
    commissionCents: commissionFor(params.amountCents),
    currency: "eur" as const,
    transferGroup: `shipment_${params.shipmentId}`,
    listingId: params.listingId,
    shipmentId: params.shipmentId,
  };
}

async function markFailed(rowId: string, reason: string, intentId?: string) {
  await db
    .update(payments)
    .set({
      status: "failed",
      failureReason: reason,
      ...(intentId ? { stripePaymentIntentId: intentId } : {}),
    })
    .where(eq(payments.id, rowId));
}

/**
 * Records a charge that already happened somewhere else.
 *
 * An escalated job's client paid in the Expedion app when they accepted the
 * quote — before this repo had a listing, let alone a driver. Awarding it here
 * must therefore charge nobody, and the row that records the money carries no
 * PaymentIntent of ours because the charge lives in Expedion's Stripe account.
 *
 * Written as `captured` because it is: the client really has been debited. That
 * is what lets `schedulePayout`, invoicing and the earnings screen go on keying
 * off `captured` without learning that some captures are not captures.
 */
async function recordExternalCharge(params: ChargeParams) {
  const [row] = await db
    .insert(payments)
    .values({
      ...baseRow(params),
      status: "captured",
      source: "expedion",
      capturedAt: new Date(),
    })
    .returning();

  return row;
}

// TODO(EXPEDITOO-TESTING): MOCK_PAYMENTS — replace with a real off-session charge against the card saved at posting (see docs/TESTING_MOCKS.md).
/**
 * Records a settled charge without calling Stripe at all, with a synthetic
 * intent id in place of a real one. The row is the shape the real path
 * produces, so everything downstream of `captured` is exercised for real.
 */
async function mockChargeForShipment(params: ChargeParams) {
  const [row] = await db
    .insert(payments)
    .values({
      ...baseRow(params),
      stripePaymentIntentId: `${MOCK_INTENT_PREFIX}${params.shipmentId}`,
      status: "captured",
      source: "stripe",
      capturedAt: new Date(),
    })
    .returning();

  return row;
}

// ========================================
// Service
// ========================================

export const paymentsService = {
  /**
   * Takes the money when an offer is accepted.
   *
   * The client pays at booking, once the transport is confirmed and chosen —
   * not on delivery (docs/specs/payment_at_booking_spec.md). This used to place
   * a manual-capture hold that `settleDelivery` captured days later; it now
   * charges outright, and delivery only settles what the driver is owed.
   *
   * Two lanes reach this, and they differ in who has already been charged:
   * a direct job's poster is debited here, an Expedion client was debited in
   * that app long before the award.
   */
  async chargeForShipment(params: ChargeParams) {
    // Charging twice for one shipment would double-debit the client, so an
    // existing settled charge is returned rather than repeated. `acceptOffer`
    // returns early on a re-accept, but a compensated award that is then
    // re-awarded reaches here a second time.
    const existing = await db.query.payments.findFirst({
      where: eq(payments.shipmentId, params.shipmentId),
    });
    if (existing?.status === "captured") return existing;

    // Ahead of the mock branch on purpose. A job paid in Expedion is not a
    // mock of anything — it is the real shape of that lane, and it is what
    // makes an escalated award possible at all: the listing is owned by a
    // system account nobody signs into and no card belongs to, so any branch
    // that reaches the `stripeCustomerId` guard below would fail every time.
    if (params.source === "expedion") {
      return await recordExternalCharge(params);
    }

    // TODO(EXPEDITOO-TESTING): MOCK_PAYMENTS — replace with a real off-session charge against the card saved at posting (see docs/TESTING_MOCKS.md).
    // Before the customer check on purpose: a test shipper has no saved card.
    if (isMockPaymentsEnabled()) {
      return await mockChargeForShipment(params);
    }

    if (!params.stripeCustomerId) {
      throw err("PAYMENT_METHOD_REQUIRED", 402, "Add a payment method first");
    }

    // The card was collected before the job went on the board, so its absence
    // here means it was detached between posting and award.
    const card = await firstSavedCard(params.stripeCustomerId);
    if (!card) {
      throw err("PAYMENT_METHOD_REQUIRED", 402, "Add a payment method first");
    }

    const [row] = await db
      .insert(payments)
      .values({ ...baseRow(params), status: "pending", source: "stripe" })
      .returning();

    try {
      const intent = await stripe.paymentIntents.create({
        amount: params.amountCents,
        currency: "eur",
        customer: params.stripeCustomerId,
        payment_method: card,
        // Taken now, not held.
        capture_method: "automatic",
        confirm: true,
        // An operator may award an escalated job with the client nowhere near
        // a browser, so an SCA challenge fails the charge rather than
        // prompting someone who is not there.
        off_session: true,
        transfer_group: row.transferGroup ?? undefined,
        metadata: {
          shipmentId: params.shipmentId,
          listingId: params.listingId,
        },
      });

      if (intent.status !== "succeeded") {
        // The intent id is kept so support can find the attempt at Stripe.
        await markFailed(row.id, `intent ${intent.status}`, intent.id);
        throw err("PAYMENT_CHARGE_FAILED", 402, "Could not take payment");
      }

      const [captured] = await db
        .update(payments)
        .set({
          stripePaymentIntentId: intent.id,
          status: "captured",
          capturedAt: new Date(),
        })
        .where(eq(payments.id, row.id))
        .returning();

      return captured;
    } catch (cause) {
      // The branch above already marked the row and is only passing through.
      if (cause instanceof PaymentError) throw cause;

      await markFailed(
        row.id,
        cause instanceof Error ? cause.message : "unknown"
      );
      throw err("PAYMENT_CHARGE_FAILED", 402, "Could not take payment");
    }
  },

  /**
   * Whether this user has a card the platform could charge.
   *
   * Read before a direct job goes on the board, so no carrier spends effort
   * bidding on work that cannot be paid for
   * (docs/specs/payment_at_booking_spec.md §4).
   */
  async hasSavedCard(userId: string) {
    const record = await db.query.user.findFirst({ where: eq(user.id, userId) });
    if (!record?.stripeCustomerId) return false;

    return (await firstSavedCard(record.stripeCustomerId)) !== null;
  },

  /**
   * Gives the money back when an awarded job is cancelled or un-awarded.
   *
   * This replaced `releaseForShipment`: there is no longer a hold to let go of,
   * because the client was charged the moment the transport was chosen.
   */
  async refundForShipment(shipmentId: string) {
    const payment = await db.query.payments.findFirst({
      where: eq(payments.shipmentId, shipmentId),
    });

    if (!payment) return null;
    if (payment.status === "refunded") return payment;

    // Expedion took this money, into Expedion's own Stripe account. There is
    // nothing here to give back, and refunding the client is that app's to do —
    // `reportToExpedion(..., "CANCELLED")` is what tells it the job is off.
    if (payment.source === "expedion") {
      throw err("REFUND_NOT_LOCAL", 409, "Refund this in Expedion");
    }

    // A payment that never reached `captured` took nothing from the client, so
    // there is nothing to give back and nothing to restate. Marking it
    // `refunded` would put a refund in front of an operator that never
    // happened; the row is left as it is.
    if (payment.status !== "captured") return payment;

    // TODO(EXPEDITOO-TESTING): MOCK_PAYMENTS — a synthetic charge has nothing at Stripe to refund; only the row moves.
    if (
      payment.stripePaymentIntentId &&
      !isMockIntent(payment.stripePaymentIntentId)
    ) {
      await stripe.refunds.create({
        payment_intent: payment.stripePaymentIntentId,
        reason: "requested_by_customer",
      });
    }

    const [refunded] = await db
      .update(payments)
      .set({ status: "refunded", refundedAt: new Date() })
      .where(eq(payments.id, payment.id))
      .returning();

    return refunded;
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
