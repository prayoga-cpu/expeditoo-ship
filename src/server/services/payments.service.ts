import { nanoid } from "nanoid";
import type Stripe from "stripe";
import { db } from "@/db";
import { and, desc, eq, inArray, type SQL } from "drizzle-orm";
import {
  payments,
  payouts,
  type Payment,
  type PaymentSource,
  type Payout,
} from "@/db/schema/payments";
import { user } from "@/db/schema/users";
import { stripe } from "@/lib/stripe";
import {
  MOCK_INTENT_PREFIX,
  isMockIntent,
  isMockPaymentsEnabled,
} from "@/lib/stripe/mock-payments";
import { invoicesService } from "@/server/services/invoices.service";
import {
  platformSettingsService,
  platformFeeFor,
} from "@/server/services/platform-settings.service";

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
 * through Stripe Connect. Connect (`executePayout`) is still wired to nothing —
 * no caller — but it is no longer *broken*: it reads the destination account
 * off the user row, which is the only place onboarding has ever written one.
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

type Executor =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];

type ChargeParams = {
  shipperId: string;
  shipmentId: string;
  listingId: string;
  amountCents: number;
  stripeCustomerId: string | null;
  source: PaymentSource;
  /** The award being paid for — what an authorised intent is checked against. */
  offerId?: string;
  /**
   * An intent the requester authorised in the payment dialog. Captured instead
   * of charging a saved card (pay_at_accept_spec.md §3.3).
   */
  paymentIntentId?: string;
};

/** What the requester is shown before paying, and what the card is debited. */
export type ChargeQuote = {
  required: boolean;
  reason: "charge" | "mock" | "prepaid";
  priceCents: number;
  platformFeeCents: number;
  totalCents: number;
  savedCard: { brand: string; last4: string } | null;
};

/** Marks an intent as minted by the payment dialog, for nothing else to reuse. */
const ACCEPT_INTENT_PURPOSE = "offer_accept";

/** States an intent can be cancelled from — anything short of captured. */
const RELEASABLE_INTENT_STATUSES = new Set<Stripe.PaymentIntent.Status>([
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
  "requires_capture",
]);

/** The card an off-session charge will be put on, or null if there is none. */
async function firstSavedCard(customerId: string): Promise<string | null> {
  return (await firstSavedCardDetails(customerId))?.id ?? null;
}

/** The same card, with what the payment dialog shows of it. */
async function firstSavedCardDetails(customerId: string) {
  const methods = await stripe.paymentMethods.list({
    customer: customerId,
    type: "card",
  });
  const method = methods.data[0];
  if (!method) return null;
  return {
    id: method.id,
    brand: method.card?.brand ?? "card",
    last4: method.card?.last4 ?? "",
  };
}

/**
 * The row every branch below starts from: the attempt, before its outcome.
 *
 * `platformFeeCents` defaults to 0 — an additive surcharge on the *client's*
 * side, unrelated to `commissionCents` (a cut from the *carrier's* side).
 * `amountCents` keeps meaning "offer price" either way, so payout math
 * (`payouts.amountCents = payment.amountCents - payment.commissionCents`)
 * never sees the fee and stays correct without change.
 */
function baseRow(params: ChargeParams, platformFeeCents = 0) {
  return {
    id: nanoid(),
    userId: params.shipperId,
    amountCents: params.amountCents,
    commissionCents: commissionFor(params.amountCents),
    platformFeeCents,
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
  // Idempotent per *listing*, not per shipment. Award → withdraw → re-award
  // mints a fresh shipment each time, and the Expedion client paid once, for
  // the quote. A per-shipment key would write a second `captured` row for that
  // one payment and inflate recorded revenue by the price of the job, so the
  // existing row is re-pointed at the replacement shipment instead
  // (cancellations_spec.md §6.4).
  const existing = await findJobPayment(params.listingId);
  if (existing?.status === "captured" && existing.source === "expedion") {
    // The whole agreed row moves, not just the pointer. The replacement driver
    // bid their own price, and `schedulePayout` reads `amountCents` and
    // `commissionCents` off this row to decide what they are owed — leaving the
    // first driver's numbers behind pays the second one the wrong amount, in
    // whichever direction the two bids happen to differ.
    const [moved] = await db
      .update(payments)
      .set({
        shipmentId: params.shipmentId,
        amountCents: params.amountCents,
        commissionCents: commissionFor(params.amountCents),
        transferGroup: `shipment_${params.shipmentId}`,
      })
      .where(eq(payments.id, existing.id))
      .returning();
    return moved;
  }

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
async function mockChargeForShipment(
  params: ChargeParams,
  platformFeeCents = 0
) {
  const [row] = await db
    .insert(payments)
    .values({
      ...baseRow(params, platformFeeCents),
      stripePaymentIntentId: `${MOCK_INTENT_PREFIX}${params.shipmentId}`,
      status: "captured",
      source: "stripe",
      capturedAt: new Date(),
    })
    .returning();

  return row;
}

/**
 * The platform fee an authorised intent was created with, once it is proven to
 * be this award's (pay_at_accept_spec.md §3.3).
 *
 * The fee is read back from the intent rather than recomputed: an admin may
 * change the rate between the dialog and the accept, and the requester is
 * owed the total they were shown and authorised — nothing more is capturable
 * anyway. Every other field is checked, because an intent id is a string any
 * client can send, and the metadata is the only proof of what it was minted
 * for: only this server can write it.
 */
function authorisedFeeFor(intent: Stripe.PaymentIntent, params: ChargeParams) {
  const meta = intent.metadata ?? {};
  const fee = Number(meta.platformFeeCents);

  const isThisAward =
    meta.purpose === ACCEPT_INTENT_PURPOSE &&
    meta.offerId === params.offerId &&
    meta.listingId === params.listingId &&
    meta.shipperId === params.shipperId &&
    Number.isInteger(fee) &&
    fee >= 0 &&
    intent.currency === "eur" &&
    intent.amount === params.amountCents + fee;

  if (!isThisAward) {
    throw err("PAYMENT_INTENT_MISMATCH", 409, "This payment is not for this offer");
  }

  // The requester closed the 3-D Secure window, or the form never confirmed.
  if (intent.status !== "requires_capture") {
    throw err("PAYMENT_NOT_AUTHORISED", 402, "The card has not been authorised");
  }

  return fee;
}

/**
 * Captures the card the requester authorised in the payment dialog.
 *
 * The intent carries no `transfer_group`, so the `payment_intent.succeeded`
 * webhook ignores it: this capture is synchronous and settles the row itself.
 */
async function captureAuthorised(params: ChargeParams): Promise<Payment> {
  const intent = await stripe.paymentIntents.retrieve(params.paymentIntentId!);
  const platformFeeCents = authorisedFeeFor(intent, params);

  const [row] = await db
    .insert(payments)
    .values({
      ...baseRow(params, platformFeeCents),
      stripePaymentIntentId: intent.id,
      status: "pending",
      source: "stripe",
    })
    .returning();

  try {
    const captured = await stripe.paymentIntents.capture(intent.id);
    if (captured.status !== "succeeded") {
      await markFailed(row.id, `intent ${captured.status}`);
      throw err("PAYMENT_CHARGE_FAILED", 402, "Could not take payment");
    }
  } catch (cause) {
    if (cause instanceof PaymentError) throw cause;
    await markFailed(row.id, cause instanceof Error ? cause.message : "unknown");
    throw err("PAYMENT_CHARGE_FAILED", 402, "Could not take payment");
  }

  const [settled] = await db
    .update(payments)
    .set({ status: "captured", capturedAt: new Date() })
    .where(eq(payments.id, row.id))
    .returning();

  return await afterCapture(settled);
}

/** Stripe's refusal of a card, as opposed to Stripe being unreachable. */
const isCardError = (cause: unknown) =>
  typeof cause === "object" &&
  cause !== null &&
  (cause as { type?: unknown }).type === "StripeCardError";

/**
 * Confirms an accept intent against the requester's first saved card.
 *
 * On-session — no `off_session` — because the requester is the one pressing
 * Pay. A bank refusal is `PAYMENT_DECLINED` so the dialog can offer another
 * card; Stripe itself failing is left to reach the route as a 500.
 */
async function confirmSavedCard(
  base: Stripe.PaymentIntentCreateParams,
  customerId: string
) {
  const card = await firstSavedCard(customerId);
  if (!card) {
    throw err("PAYMENT_METHOD_REQUIRED", 402, "Add a payment method first");
  }

  try {
    return await stripe.paymentIntents.create({
      ...base,
      payment_method: card,
      confirm: true,
    });
  } catch (cause) {
    if (isCardError(cause)) {
      throw err("PAYMENT_DECLINED", 402, "The card was declined");
    }
    throw cause;
  }
}

/**
 * The money taken for a job, whichever shipment it happens to be attached to.
 *
 * A listing can carry more than one `payments` row over its life — a declined
 * attempt, then a charge, then a refund after a withdrawal — and
 * `payments.shipment_id` has no unique index behind it, so an unordered
 * `findFirst` on this table is nondeterministic. The captured row is the one
 * that matters; failing that, the most recent, so a caller asking about a job
 * that was never successfully charged still gets told what happened rather
 * than `null`.
 */
async function findJobPayment(listingId: string): Promise<Payment | null> {
  const rows = await db.query.payments.findMany({
    where: eq(payments.listingId, listingId),
    orderBy: [desc(payments.createdAt)],
  });

  return capturedOrLatest(rows);
}

/**
 * The same question asked of one shipment, for the same reason: a declined
 * attempt can share a shipment with the charge that later succeeded, and
 * nothing makes `payments.shipment_id` unique. `settleDelivery` reads this, and
 * since the capture webhook stopped writing payouts, `settleDelivery` is the
 * only writer of a driver's pay — an unordered read that handed it the dead
 * attempt would leave a delivered job unpaid (payout_safety_spec.md §1).
 */
async function findShipmentPayment(shipmentId: string): Promise<Payment | null> {
  const rows = await db.query.payments.findMany({
    where: eq(payments.shipmentId, shipmentId),
    orderBy: [desc(payments.createdAt)],
  });

  return capturedOrLatest(rows);
}

/** From newest-first attempts: the one that took the money, else the newest. */
function capturedOrLatest(rows: Payment[]): Payment | null {
  return rows.find((row) => row.status === "captured") ?? rows[0] ?? null;
}

/**
 * Voids the driver's share of money that has gone back to the client
 * (payout_safety_spec.md §3).
 *
 * `processing` is included, where only `scheduled` used to be: a payout a
 * withdrawal request has claimed is still unpaid — nothing is transferred until
 * an operator records it — and leaving it standing let that request be
 * approved, and a refusal put it straight back in the balance. `paid` is never
 * touched: that money has already left.
 */
async function voidUnpaidPayouts(scope: SQL, tx: Executor = db) {
  return await tx
    .update(payouts)
    .set({ status: "cancelled" })
    .where(and(scope, inArray(payouts.status, ["scheduled", "processing"])))
    .returning();
}

/** A transfer Stripe refused, recorded on the row so support can read why. */
async function markPayoutFailed(payoutId: string, cause: unknown) {
  await db
    .update(payouts)
    .set({
      status: "failed",
      failureReason: cause instanceof Error ? cause.message : "unknown",
    })
    .where(eq(payouts.id, payoutId));
}

/**
 * Refuses a payout row whose money must not move, whatever the account says.
 *
 * `paid` is idempotency and returns rather than throwing; these two are the
 * cases where transferring would be money leaving with nothing behind it.
 *
 *  - `cancelled` is written by `cancelPayoutForShipment` and `markRefunded`
 *    when the client has been refunded (cancellations_spec.md §6.6,
 *    payout_safety_spec.md §3). The job's money went back, so
 *    sending the driver their share of it pays them out of the platform's own
 *    pocket for a delivery nobody bought.
 *  - A `withdrawalId` means the row is already claimed by a withdrawal request,
 *    and that is the flow the driver's share *actually* moves through today —
 *    they ask, an operator approves, somebody makes the transfer by hand
 *    (`withdrawals.service.ts`). Transferring it here as well pays the same
 *    earned money twice, and `withdrawalsDal.availableFor` cannot notice
 *    because it already stopped counting the row the moment it was claimed.
 *
 * Both are checked before the account is even resolved: a driver with no
 * Connect account is the lesser problem, and answering about their onboarding
 * would hide the fact that this row was never payable.
 */
function refuseUnpayable(payout: Payout): void {
  if (payout.status === "cancelled") {
    throw err("PAYOUT_CANCELLED", 409, "This payout was voided by a refund");
  }

  if (payout.withdrawalId) {
    throw err(
      "PAYOUT_ALREADY_CLAIMED",
      409,
      "A withdrawal request already covers this payout"
    );
  }
}

/**
 * The Connect account a payout may be sent to, or the reason it may not.
 *
 * `payouts.carrier_id` is a **user** id — the column references `user.id`, and
 * its one writer (`settleDelivery`) passes `shipments.carrier_id`, which
 * references it too. That is also where
 * onboarding puts the account: `stripeService.createConnectAccount` writes
 * `stripeAccountId` onto the user row. This read went to
 * `carriers.stripe_account_id` instead — a column the schema declares and
 * *nothing in the codebase has ever written* — so a driver who finished Connect
 * onboarding was refused `CARRIER_ACCOUNT_MISSING` forever, with no write path
 * anywhere that could have cleared it.
 *
 * The status gate is deliberate rather than incidental. Onboarding writes
 * `pending`; only `account.updated` (or an explicit `checkAccountStatus`)
 * promotes it to `active`, and Stripe refuses a transfer to an account whose
 * `payouts_enabled` is still false. Left to Stripe that arrives as a raw throw,
 * which `executePayout`'s catch records as `PAYOUT_FAILED` 502 — a platform
 * fault, on a payout now stamped `failed` and needing a human to un-fail it —
 * when the truth is a 409 the driver themselves can clear by finishing
 * onboarding. `restricted` is the same answer for the same reason: Stripe has
 * looked at the account and is not paying out to it yet.
 */
async function connectAccountFor(carrierUserId: string): Promise<string> {
  const record = await db.query.user.findFirst({
    where: eq(user.id, carrierUserId),
  });

  if (!record?.stripeAccountId) {
    throw err("CARRIER_ACCOUNT_MISSING", 409, "Connect a Stripe account first");
  }

  if (record.stripeAccountStatus !== "active") {
    throw err(
      "CARRIER_ACCOUNT_NOT_READY",
      409,
      "Finish Stripe onboarding before withdrawing"
    );
  }

  return record.stripeAccountId;
}

/**
 * Everything that must happen once money has actually been taken.
 *
 * The client is charged when the transport is chosen, so this — not delivery —
 * is when they are owed a document. It used to be raised from `settleDelivery`,
 * which is days later and only if the job completed at all
 * (docs/specs/invoice_at_payment_spec.md §1).
 *
 * Two rules live here rather than in the invoicing service, because both are
 * statements about *money* and this is the module that knows about money:
 *
 *  - Only a `stripe` charge is documented. An escalated job's client was
 *    debited in Expedion, into Expedion's Stripe account, against a listing
 *    owned by a system account nobody signs into. An Expeditoo invoice for that
 *    payment would assert a charge this company never made — and could never be
 *    corrected, because `refundForJob` refuses that money outright (§3).
 *  - It never throws. A paperwork failure must not un-award a job whose client
 *    has already been debited; the document can be re-raised, the charge cannot
 *    be un-taken.
 */
async function afterCapture(payment: Payment): Promise<Payment> {
  if (payment.source !== "stripe") return payment;

  try {
    await invoicesService.createFromPayment(payment.id);
  } catch (error) {
    console.error(`Invoice creation failed for payment ${payment.id}`, error);
  }

  return payment;
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
      return await afterCapture(await recordExternalCharge(params));
    }

    // Ahead of the mock branch too: an intent the requester authorised is a
    // real `pi_…`, and a real intent stays real while MOCK_PAYMENTS is on
    // (`mock-payments.ts`). Mocking it would leave their card held for a week.
    if (params.paymentIntentId) return await captureAuthorised(params);

    // Read once per charge attempt. A hot path, but one row, one indexed
    // lookup — and an admin-configured rate must apply to every real charge,
    // not just the ones taken while someone happens to be watching.
    const feeBasisPoints = await platformSettingsService.getFeeBasisPoints();
    const platformFeeCents = platformFeeFor(params.amountCents, feeBasisPoints);

    // TODO(EXPEDITOO-TESTING): MOCK_PAYMENTS — replace with a real off-session charge against the card saved at posting (see docs/TESTING_MOCKS.md).
    // Before the customer check on purpose: a test shipper has no saved card.
    if (isMockPaymentsEnabled()) {
      return await afterCapture(
        await mockChargeForShipment(params, platformFeeCents)
      );
    }

    if (!params.stripeCustomerId) {
      throw err("PAYMENT_METHOD_REQUIRED", 402, "Add a payment method first");
    }

    // Posting no longer requires a card (docs/specs/payment_at_booking_spec.md)
    // — its absence here just as often means the requester never added one as
    // that it was detached after the fact.
    const card = await firstSavedCard(params.stripeCustomerId);
    if (!card) {
      throw err("PAYMENT_METHOD_REQUIRED", 402, "Add a payment method first");
    }

    const [row] = await db
      .insert(payments)
      .values({
        ...baseRow(params, platformFeeCents),
        status: "pending",
        source: "stripe",
      })
      .returning();

    try {
      const intent = await stripe.paymentIntents.create({
        // The only line the fee changes: what is actually captured.
        // `payments.amountCents` stays the offer price — see `baseRow`.
        amount: params.amountCents + platformFeeCents,
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
          platformFeeCents: String(platformFeeCents),
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

      return await afterCapture(captured);
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
   * What accepting an offer on a direct job will debit, and with which card.
   *
   * Read-only: it never creates a Stripe customer, because the payment dialog
   * asks this the moment it opens (pay_at_accept_spec.md §3.1). Under
   * MOCK_PAYMENTS nothing is charged, so no card is looked up either.
   */
  async quoteCharge(params: {
    amountCents: number;
    stripeCustomerId: string | null;
  }): Promise<ChargeQuote> {
    const feeBasisPoints = await platformSettingsService.getFeeBasisPoints();
    const platformFeeCents = platformFeeFor(params.amountCents, feeBasisPoints);
    const mock = isMockPaymentsEnabled();

    const card =
      mock || !params.stripeCustomerId
        ? null
        : await firstSavedCardDetails(params.stripeCustomerId);

    return {
      required: !mock,
      reason: mock ? "mock" : "charge",
      priceCents: params.amountCents,
      platformFeeCents,
      totalCents: params.amountCents + platformFeeCents,
      savedCard: card ? { brand: card.brand, last4: card.last4 } : null,
    };
  },

  /**
   * Authorises the requester's card for one award, on-session, and holds it
   * for the seconds until `chargeForShipment` captures it.
   *
   * `saved` confirms here against the first saved card, and answers
   * `requires_action` when the bank wants 3-D Secure — the requester is at the
   * keyboard to answer it, which an off-session charge could never ask. `new`
   * returns a client secret for the card form, and keeps the card only when
   * the requester ticked the box (pay_at_accept_spec.md §3.2).
   */
  async authoriseForAccept(params: {
    shipperId: string;
    offerId: string;
    listingId: string;
    amountCents: number;
    resolveCustomer: () => Promise<string>;
    method: "saved" | "new";
    saveCard: boolean;
  }) {
    // TODO(EXPEDITOO-TESTING): MOCK_PAYMENTS — nothing is charged, so there is nothing to authorise (see docs/TESTING_MOCKS.md).
    if (isMockPaymentsEnabled()) {
      throw err("PAYMENT_NOT_REQUIRED", 409, "Nothing to pay in test mode");
    }

    const customerId = await params.resolveCustomer();
    const feeBasisPoints = await platformSettingsService.getFeeBasisPoints();
    const platformFeeCents = platformFeeFor(params.amountCents, feeBasisPoints);

    const base = {
      amount: params.amountCents + platformFeeCents,
      currency: "eur",
      customer: customerId,
      payment_method_types: ["card"],
      capture_method: "manual" as const,
      metadata: {
        purpose: ACCEPT_INTENT_PURPOSE,
        offerId: params.offerId,
        listingId: params.listingId,
        shipperId: params.shipperId,
        platformFeeCents: String(platformFeeCents),
      },
    };

    const intent =
      params.method === "saved"
        ? await confirmSavedCard(base, customerId)
        : await stripe.paymentIntents.create({
            ...base,
            ...(params.saveCard ? { setup_future_usage: "off_session" } : {}),
          });

    return {
      paymentIntentId: intent.id,
      status: intent.status,
      clientSecret: intent.client_secret,
    };
  },

  /**
   * Cancels an authorisation the award did not use, so the bank releases the
   * hold now instead of in a week (pay_at_accept_spec.md §3.4).
   *
   * Only an intent minted for this award by this requester is touched — an id
   * is a string anybody can send, and cancelling someone else's would void
   * their payment. Never throws: the accept is already failing, and a release
   * that does not go through only means the bank releases it later.
   */
  async releaseAcceptIntent(
    paymentIntentId: string,
    award: { offerId: string; shipperId: string }
  ) {
    try {
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
      const meta = intent.metadata ?? {};
      if (
        meta.purpose !== ACCEPT_INTENT_PURPOSE ||
        meta.offerId !== award.offerId ||
        meta.shipperId !== award.shipperId
      ) {
        return;
      }
      if (!RELEASABLE_INTENT_STATUSES.has(intent.status)) return;

      await stripe.paymentIntents.cancel(paymentIntentId);
    } catch (error) {
      console.error(`Could not release intent ${paymentIntentId}`, error);
    }
  },

  /**
   * Gives the money back when a job is cancelled or a transporter withdraws.
   *
   * This replaced `releaseForShipment`: there is no longer a hold to let go of,
   * because the client was charged the moment the transport was chosen.
   *
   * Keyed on the **listing**, not the shipment. A withdrawal kills the shipment
   * and puts the job back on the board, so a refund keyed on the dead shipment
   * would walk straight past money that is still the client's — and every award
   * mints a fresh shipment, so the listing is the only stable handle on "the
   * money taken for this job" (cancellations_spec.md §6.1).
   */
  async refundForJob(listingId: string) {
    const payment = await findJobPayment(listingId);

    if (!payment) return null;
    // Already given back — but the correction may not have been written, since
    // `markRefunded` contains its own failure rather than rolling the refund
    // back. Retrying it here is the avoir's backstop, the same role
    // `settleDelivery` plays for the invoice; it is idempotent on the document.
    if (payment.status === "refunded") {
      await invoicesService
        .createCreditNoteForPayment(payment.id)
        .catch((e) => console.error(`Credit note retry failed`, e));
      return payment;
    }

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

    return await this.markRefunded(payment.id);
  },

  /**
   * Voids the payout of a run that has just been called off.
   *
   * Payouts are written at delivery now, and a delivered run cannot be
   * cancelled — so what this still finds was written by the capture webhook at
   * award before 2.60.0: `scheduled`, or `processing` if a withdrawal request
   * has claimed it since. Either way the run is over and that pay is not owed,
   * even when the refund itself is Expedion's to make or fails: it is called
   * before the refund and whatever its outcome (cancellations_spec.md §6.6,
   * payout_safety_spec.md §3). The withdrawal link is kept, so the request it
   * sits in visibly covers a voided payout until an operator refuses it.
   *
   * Contained like the refund itself: a cancellation must not fail on this.
   */
  async cancelPayoutForShipment(shipmentId: string) {
    const [row] = await voidUnpaidPayouts(eq(payouts.shipmentId, shipmentId));

    return row ?? null;
  },

  /**
   * The only transition into `refunded`, and where the correction is raised.
   *
   * Both refund writers go through it — this service and
   * `refundService.processRefund`, which is exposed at `POST /api/admin/refunds`
   * and previously wrote the row itself. Wiring the credit note to one of them
   * would leave the other giving money back with a paid invoice still standing
   * (docs/specs/invoice_at_payment_spec.md §5).
   *
   * The driver's unpaid share goes in the same transaction as the flip. That
   * admin route is the one path that can refund a *delivered* job, and it
   * voided nothing, so the driver could still withdraw pay for a job whose
   * client had their money back. Apart, a withdrawal settled between the two
   * writes would record as paid a payout whose money was already returned
   * (payout_safety_spec.md §3).
   */
  async markRefunded(paymentId: string) {
    const refunded = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(payments)
        .set({ status: "refunded", refundedAt: new Date() })
        .where(eq(payments.id, paymentId))
        .returning();

      if (!row) throw err("PAYMENT_NOT_FOUND", 404);

      await voidUnpaidPayouts(eq(payouts.paymentId, row.id), tx);
      return row;
    });

    // An issued, numbered, emailed document is corrected by a second document,
    // never by mutating the first. Contained like the issue itself: the money
    // is back either way.
    try {
      await invoicesService.createCreditNoteForPayment(refunded.id);
    } catch (error) {
      console.error(`Credit note failed for payment ${refunded.id}`, error);
    }

    return refunded;
  },

  /**
   * Settles a payment Stripe has told us succeeded out of band.
   *
   * The webhook used to write `captured` itself, with no `capturedAt` and no
   * status predicate. Both mattered: `chargeForShipment` stamps the intent id
   * onto a *failed* row when the intent comes back non-succeeded, so a later
   * `payment_intent.succeeded` settled a job outside every service and raised
   * no document; and with no predicate, a retry arriving after a refund turned
   * the refunded row back into a captured one.
   */
  async captureByIntent(intentId: string) {
    const payment = await db.query.payments.findFirst({
      where: eq(payments.stripePaymentIntentId, intentId),
    });

    if (!payment) return null;
    // Already settled, or settled and since given back. Either way this event
    // is old news, and re-running it would double the paperwork.
    if (payment.status !== "pending" && payment.status !== "failed") {
      return payment;
    }

    const [captured] = await db
      .update(payments)
      .set({ status: "captured", capturedAt: new Date(), failureReason: null })
      .where(eq(payments.id, payment.id))
      .returning();

    return await afterCapture(captured);
  },

  /**
   * Records what the carrier has earned. Commission is held at source, so the
   * payout is the job price minus the platform's cut.
   *
   * Called from one place, `settleDelivery`, on the transition into
   * `DELIVERED`. The capture webhook called it too, at award, which made pay
   * for an undriven job withdrawable (payout_safety_spec.md §1).
   *
   * Drawn on the captured charge only: the balance counts a payout as long as
   * the payment it names is still captured, so one drawn on a declined attempt
   * that shares the shipment would never be paid.
   */
  async schedulePayout(shipmentId: string, carrierId: string) {
    const payment = await findShipmentPayment(shipmentId);
    if (payment?.status !== "captured") {
      throw err(
        "PAYMENT_NOT_CAPTURED",
        409,
        "No captured payment for this shipment"
      );
    }

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
   *
   * Nothing calls this yet — the driver's share reaches them through
   * `withdrawals.service.ts`, by hand. It is kept working rather than deleted
   * because the account it needs is now readable (`connectAccountFor`), and the
   * day this is wired up it must not answer 409 to every onboarded driver.
   */
  async executePayout(payoutId: string) {
    const payout = await db.query.payouts.findFirst({
      where: eq(payouts.id, payoutId),
    });
    if (!payout) throw err("PAYOUT_NOT_FOUND", 404);
    if (payout.status === "paid") return payout;

    // Every refusal below sits outside the try on purpose: none of them is a
    // transfer that failed, and stamping `failed` on a payout Stripe was never
    // asked about would drop it out of `withdrawalsDal.availableFor` — money
    // the driver has earned, gone from their balance because of a state that
    // says nothing about whether they earned it.
    refuseUnpayable(payout);
    const destination = await connectAccountFor(payout.carrierId);

    const payment = payout.paymentId
      ? await db.query.payments.findFirst({
          where: eq(payments.id, payout.paymentId),
        })
      : null;

    try {
      const transfer = await stripe.transfers.create({
        amount: payout.amountCents,
        currency: payout.currency,
        destination,
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
      await markPayoutFailed(payout.id, cause);
      throw err("PAYOUT_FAILED", 502);
    }
  },

  /** The money taken for this shipment — see `findShipmentPayment`. */
  async getForShipment(shipmentId: string) {
    return await findShipmentPayment(shipmentId);
  },

  async getCarrierPayouts(carrierId: string) {
    return await db.query.payouts.findMany({
      where: eq(payouts.carrierId, carrierId),
    });
  },
};
