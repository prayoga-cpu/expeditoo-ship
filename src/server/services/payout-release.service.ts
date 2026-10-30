import { stripe } from "@/lib/stripe";
import { withdrawalsDal } from "@/server/dal/withdrawals.dal";
import { payoutNoticesService } from "@/server/services/payout-notices.service";

/**
 * « Automatic payout when the status becomes Delivered », « held if a problem
 * is reported at delivery » (client_feedback_2026_10_29_spec.md §N3, §N4).
 *
 * An hourly sweep, not a call inside the delivery: the client needs time to
 * report a problem, and a transfer sent the minute the driver tapped « Livré »
 * would pre-empt the very hold Nicolas asked for. So a payout is released
 * {@link PAYOUT_HOLD_HOURS} after delivery, if nothing was reported, through
 * Stripe Connect to the driver's own account — Stripe holds their IBAN; this
 * platform never does.
 *
 * **Not scheduled** (decision of 30 October, client_feedback_2026_10_29_spec.md
 * §0 R): payouts stay request → approve → paid by hand until the lawyer clears
 * Stripe Connect. Production already holds one active Connect account, so a
 * scheduled sweep would have moved real money. Switching on is the transfer
 * step only: a `GET /api/cron/release-payouts` route that calls `releaseDue`
 * and records its heartbeat, a `CRON_JOBS` entry, and an hourly line in
 * `scheduled-jobs.yml` (spec §N3 has the route as it was).
 *
 * Every write is conditional on the state it moves from (gotcha 17): a payout
 * a withdrawal request claimed meanwhile is skipped, and a transfer Stripe
 * refuses puts the payout back in the balance rather than marking it failed.
 */

export const PAYOUT_HOLD_HOURS = 48;
const BATCH = 50;

export interface ReleaseResult {
  released: number;
  skipped: number;
  failed: number;
}

/** The charge a transfer is funded from, so it may go before funds settle. */
async function chargeOf(paymentIntentId: string): Promise<string | null> {
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  const charge = intent.latest_charge;
  return typeof charge === "string" ? charge : (charge?.id ?? null);
}

export const payoutReleaseService = {
  async releaseDue(now: Date = new Date()): Promise<ReleaseResult> {
    const due = await withdrawalsDal.releasable(
      now,
      PAYOUT_HOLD_HOURS * 3_600_000,
      BATCH
    );
    const result: ReleaseResult = { released: 0, skipped: 0, failed: 0 };

    for (const payout of due) {
      const claimed = await withdrawalsDal.claimForRelease(payout.id);
      if (!claimed || !payout.destination || !payout.paymentIntentId) {
        result.skipped++;
        continue;
      }

      try {
        const sourceTransaction = await chargeOf(payout.paymentIntentId);
        const transfer = await stripe.transfers.create(
          {
            amount: payout.amountCents,
            currency: payout.currency,
            destination: payout.destination,
            transfer_group: payout.transferGroup ?? undefined,
            ...(sourceTransaction ? { source_transaction: sourceTransaction } : {}),
            metadata: { payoutId: payout.id, shipmentId: payout.shipmentId },
          },
          // A retried run must not pay twice.
          { idempotencyKey: `payout_release_${payout.id}` }
        );
        await withdrawalsDal.markReleased(payout.id, transfer.id);
        await payoutNoticesService.paid(payout.carrierId, payout.amountCents, transfer.id);
        result.released++;
      } catch (error) {
        const reason = error instanceof Error ? error.message : "unknown";
        console.error(`Payout release failed for ${payout.id}:`, reason);
        await withdrawalsDal.releaseClaim(payout.id, reason);
        result.failed++;
      }
    }

    return result;
  },
};
