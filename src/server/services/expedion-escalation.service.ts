/**
 * ============================================================================
 * Escalation bridge: Expedion → Expeditoo — Phase D
 * ============================================================================
 *
 * When no driver in the pool takes a paid Expedion job, it becomes a live
 * Expeditoo listing and carriers bid on it. The client never leaves Expedion:
 * the selected carrier and every subsequent status write back onto the quote.
 *
 * Both roadmaps make the same point about why this lives on one database —
 * across two, escalation is a distributed transaction; on one it is a status
 * change plus an insert.
 *
 * The two bridge columns are already on `listings`:
 *   `origin`       'direct' | 'expedion'
 *   `externalRef`  the Expedion quote id
 */

import { nanoid } from "nanoid";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import { categories } from "@/db/schema/listings";
import { carriersDal } from "@/server/dal/carriers.dal";
import { expedionDal } from "@/server/dal/expedion.dal";
import { userHasRole } from "@/server/dal/users.dal";
import { listingsService } from "@/server/services/listings.service";
import { listingsDal } from "@/server/dal/listings.dal";
import { offersService } from "@/server/services/offers.service";
import { expedionSmsService } from "@/server/services/expedion-sms.service";
import { notifyExpedionAdmins } from "@/server/services/expedion-realtime.service";
import {
  ExpedionError,
  canTransition,
} from "@/server/services/expedion.service";
import type { ExpedionQuote } from "@/db/schema/expedion";

const err = (code: string, status: number, message?: string) =>
  new ExpedionError(code, status, message);

/**
 * Re-labels an offers-engine failure as an Expedion one.
 *
 * `expedionErrorResponse` only translates `ExpedionError`, `ExpedionAuthError`
 * and `ZodError`; an `OfferError` — which is what every guard inside
 * `submitOffer` and `acceptOffer` throws — fell through to a bare 500 reading
 * "An unexpected error occurred". The operator has to be told that the vehicle
 * is too small, or that the hold was declined, because each one has a
 * different next move.
 *
 * Duck-typed rather than `instanceof OfferError`, so this module does not pull
 * the offers service's whole dependency graph in for a type it only reads two
 * fields off.
 */
function asExpedionError(cause: unknown, listingId: string): ExpedionError {
  const e = cause as { code?: unknown; status?: unknown; message?: unknown };
  if (typeof e?.code === "string" && typeof e?.status === "number") {
    return new ExpedionError(
      e.code,
      e.status,
      `${typeof e.message === "string" ? e.message : e.code} — the job is now ` +
        `on the marketplace as listing ${listingId} and can still be awarded there`
    );
  }
  return cause instanceof ExpedionError
    ? cause
    : err(
        "ASSIGNMENT_FAILED",
        500,
        `The job was published as listing ${listingId} but the driver could not ` +
          `be awarded it`
      );
}

// ========================================
// Policy
// ========================================

/** Bidding window handed to carriers, measured from escalation. */
const PICKUP_LEAD_DAYS = 2;
const PICKUP_WINDOW_DAYS = 7;
const DROPOFF_LEAD_DAYS = 3;
const DROPOFF_WINDOW_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The auction house is not one of the 13 location types, and guessing wrong
 * changes what carriers quote. `other` is the honest answer, and it avoids the
 * apartment floor/lift requirement that would otherwise reject the listing.
 */
const AUCTION_LOCATION_TYPE = "other" as const;

/**
 * Escalated jobs are owned by a dedicated platform account rather than by the
 * Expedion buyer, who has no Better Auth identity while Expedion stays on
 * Firebase (ROADMAP.md §5). Carriers bid against Expedion-as-shipper.
 */
function systemShipperId(): string {
  const id = process.env.EXPEDION_SYSTEM_USER_ID;
  if (!id) {
    throw err(
      "EXPEDION_SYSTEM_USER_UNSET",
      503,
      "EXPEDION_SYSTEM_USER_ID must point at the account that owns escalated listings"
    );
  }
  return id;
}

async function resolveCategoryId(): Promise<string> {
  // The configured id is checked rather than trusted. It was returned
  // unverified, so an `EXPEDION_CATEGORY_ID` naming a category that does not
  // exist — the state of every environment whose seed predates the variable —
  // reached `createListing` and died on the foreign key, which reads as
  // "escalation is broken" rather than "this one setting is wrong".
  const configured = process.env.EXPEDION_CATEGORY_ID;
  if (configured) {
    const exists = await db.query.categories.findFirst({
      where: eq(categories.id, configured),
    });
    if (exists) return exists.id;
    console.warn(
      `[expedion] EXPEDION_CATEGORY_ID="${configured}" matches no category; ` +
        `falling back to the 'encheres' slug`
    );
  }

  const bySlug = await db.query.categories.findFirst({
    where: eq(categories.slug, "encheres"),
  });
  if (bySlug) return bySlug.id;

  const [any] = await db.select({ id: categories.id }).from(categories).limit(1);
  if (!any) throw err("NO_CATEGORY", 503, "No transport category configured");
  return any.id;
}

// ========================================
// Mapping
// ========================================

/** Postal codes must be exactly five digits for the listing contract. */
function normalisePostalCode(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return /^\d{5}$/.test(digits) ? digits : null;
}

/** `description` has a 20-character floor; a terse lot line needs padding. */
function buildDescription(quote: ExpedionQuote): string {
  const parts = [
    quote.description?.trim(),
    quote.auctionHouseName
      ? `Retrait chez ${quote.auctionHouseName}.`
      : "Retrait en hôtel des ventes.",
    quote.bordereauNumber ? `Bordereau ${quote.bordereauNumber}.` : null,
    quote.lengthCm && quote.widthCm && quote.heightCm
      ? `Dimensions ${quote.lengthCm} x ${quote.widthCm} x ${quote.heightCm} cm.`
      : null,
    quote.isProtected ? "Objet emballé." : "Objet non emballé, à protéger.",
    "Job escaladé depuis Expedion Enchères.",
  ].filter(Boolean);
  return parts.join(" ").slice(0, 5000);
}

function buildTitle(quote: ExpedionQuote): string {
  const base =
    quote.description?.trim().split(/[.;\n]/)[0]?.trim() ||
    `Retrait enchères ${quote.pickupCity ?? ""}`.trim();
  const title = base.length >= 5 ? base : `Retrait enchères ${base}`;
  return title.slice(0, 120);
}

/**
 * Everything a listing needs that a quote might not have. Returned as a list
 * so the caller can say precisely what is blocking rather than "invalid".
 */
export function escalationBlockers(quote: ExpedionQuote): string[] {
  const blockers: string[] = [];
  if (quote.pickupLat == null || quote.pickupLng == null)
    blockers.push("pickup coordinates");
  if (quote.deliveryLat == null || quote.deliveryLng == null)
    blockers.push("delivery coordinates");
  if (!quote.pickupAddress) blockers.push("pickup address");
  if (!quote.pickupCity) blockers.push("pickup city");
  if (!normalisePostalCode(quote.pickupPostalCode))
    blockers.push("pickup postal code");
  if (!quote.deliveryAddress) blockers.push("delivery address");
  if (!quote.deliveryCity) blockers.push("delivery city");
  if (!normalisePostalCode(quote.deliveryPostalCode))
    blockers.push("delivery postal code");
  if (!quote.weightKg || quote.weightKg <= 0) blockers.push("weight");
  if (!quote.acceptedPriceCents || quote.acceptedPriceCents < 100)
    blockers.push("accepted price");
  return blockers;
}

// ========================================
// Service
// ========================================

export const expedionEscalationService = {
  /**
   * Pushes a quote onto the Expeditoo marketplace.
   *
   * Idempotent by construction: `claimForEscalation` only succeeds for the
   * first caller, so an admin forcing escalation while the cron sweep runs
   * cannot produce two listings for one quote.
   */
  async escalate(
    quoteId: string,
    opts: {
      reason?: string;
      actor?: string;
      /**
       * Suppresses the "your job is going out to tender" text and records the
       * quote as pool-assigned. Set only by `assignDirect`, which uses this
       * path for its machinery, not for its meaning — the client is getting a
       * named driver, and telling them the opposite is worse than telling them
       * nothing.
       */
      directAssignment?: boolean;
    } = {}
  ) {
    const quote = await expedionDal.getById(quoteId);
    if (!quote) throw err("QUOTE_NOT_FOUND", 404);
    if (quote.listingId) {
      throw err("ALREADY_ESCALATED", 409, "This quote is already on Expeditoo");
    }
    if (!canTransition(quote.status, "escalated")) {
      throw err(
        "INVALID_TRANSITION",
        409,
        `Cannot escalate from ${quote.status}`
      );
    }

    const blockers = escalationBlockers(quote);
    if (blockers.length > 0) {
      throw err(
        "ESCALATION_INCOMPLETE",
        422,
        `Missing for a marketplace listing: ${blockers.join(", ")}`
      );
    }

    // Claim first. If another run already took it, stop without side effects.
    const claimed = await expedionDal.claimForEscalation(quoteId, new Date());
    if (!claimed) {
      throw err("ALREADY_ESCALATED", 409, "Escalation already in progress");
    }

    const now = Date.now();
    const categoryId = await resolveCategoryId();

    // A previous attempt can die after the listing exists but before the quote
    // records it. `externalRef` carries the quote id, so an orphan left in that
    // window is adoptable and the retry finishes the job instead of minting a
    // second listing.
    const adopted = await listingsDal.getByExternalRef(quoteId);

    // Whether this attempt has put a listing into the world. Releasing the
    // claim is only safe while this is false — see the catch.
    let createdListing = false;

    try {
      // `prepaid` waives the card check that guards a direct posting. This
      // quote was paid in Expedion when the client accepted it, and the check
      // could not pass anyway: an escalated listing is owned by a system
      // account no card belongs to (docs/specs/payment_at_booking_spec.md §4).
      const listing =
        adopted ??
        (await listingsService.createListing(systemShipperId(), {
          title: buildTitle(quote),
          description: buildDescription(quote),
          categoryId,
          weightKg: quote.weightKg!,
          ...(quote.lengthCm && quote.widthCm && quote.heightCm
            ? {
                lengthCm: quote.lengthCm,
                widthCm: quote.widthCm,
                heightCm: quote.heightCm,
              }
            : {}),
          quantity: 1,
          // Auction lots are antiques and art far more often than not.
          isFragile: true,
          needsHelp: !quote.isProtected,
          pickup: {
            lat: quote.pickupLat!,
            lng: quote.pickupLng!,
            address: quote.pickupAddress!,
            city: quote.pickupCity!,
            postalCode: normalisePostalCode(quote.pickupPostalCode)!,
            locationType: AUCTION_LOCATION_TYPE,
          },
          dropoff: {
            lat: quote.deliveryLat!,
            lng: quote.deliveryLng!,
            address: quote.deliveryAddress!,
            city: quote.deliveryCity!,
            postalCode: normalisePostalCode(quote.deliveryPostalCode)!,
            locationType: AUCTION_LOCATION_TYPE,
          },
          pickupFrom: new Date(now + PICKUP_LEAD_DAYS * DAY_MS),
          pickupUntil: new Date(now + PICKUP_WINDOW_DAYS * DAY_MS),
          dropoffFrom: new Date(now + DROPOFF_LEAD_DAYS * DAY_MS),
          dropoffUntil: new Date(now + DROPOFF_WINDOW_DAYS * DAY_MS),
          isFlexible: true,
          budgetCents: quote.acceptedPriceCents!,
          photos: (quote.photoUrls ?? []).slice(0, 10),
          publish: true,
        }, { prepaid: true }));

      if (!adopted) {
        createdListing = true;

        // `createListing` does not take the bridge columns — they are not part
        // of the client-facing contract — so they are stamped on here.
        await listingsDal.update(listing.id, {
          origin: "expedion",
          externalRef: quote.id,
          status: "open",
        });
      }

      const updated = await db.transaction(async (tx) => {
        const row = await expedionDal.update(
          quoteId,
          {
            status: "escalated",
            listingId: listing.id,
            ...(opts.directAssignment ? { assignedDirectly: true } : {}),
          },
          tx
        );
        await expedionDal.addEvent(
          {
            id: nanoid(),
            quoteId,
            status: "escalated",
            actor: opts.actor ?? "system",
            message:
              opts.reason ??
              "Aucun transporteur disponible : mise en concurrence sur Expeditoo",
            metadata: { listingId: listing.id },
          },
          tx
        );
        return row;
      });

      void notifyExpedionAdmins(quoteId);

      // Not on a direct assignment: `assignDirect` awards a named driver in the
      // same call, and `writeBack` texts the client about that driver moments
      // later. Sending both would tell them their job went to tender and then
      // that someone won it.
      if (!opts.directAssignment) {
        void expedionSmsService
          .deliveryUpdate({
            phone: updated.phone,
            status: "escalated",
            bordereauNumber: updated.bordereauNumber,
          })
          .catch(() => undefined);
      }

      return { quote: updated, listing };
    } catch (error) {
      // Releasing the claim invites a retry, which is only safe if this attempt
      // left nothing behind. Having created a listing but failed before
      // stamping `externalRef` onto it, the adoption lookup above cannot find
      // it, so a retry would mint a second listing for one quote. Stay claimed
      // instead: a stuck quote is visible and repairable, a duplicate is not.
      if (createdListing) {
        console.error(
          `Escalation of quote ${quoteId} failed after creating a listing. ` +
            `Claim left in place to prevent a duplicate; needs manual repair.`,
          error
        );
        throw error;
      }

      // Nothing was created — release so a later run can retry, rather than
      // leaving the quote marked as escalated with no listing behind it.
      await expedionDal.update(quoteId, { escalatedAt: null });
      throw error;
    }
  },

  /**
   * Hands a paid job to a driver in the pool, without an auction.
   *
   * This is the other half of the fork a payment opens: assign, or publish and
   * let carriers bid. It is modelled as an escalation with a pre-selected
   * winner rather than as a second execution path, and that is the whole point
   * — `acceptOffer` is what creates the shipment, holds the money, rejects the
   * other bids and writes back to Expedion. Assignment that did not go through
   * it wrote three columns onto the quote and stopped: the driver never saw
   * the job in their app, no money was held, and nothing but an admin editing
   * status by hand could ever move it to `delivered`.
   *
   * The listing is `open` between `escalate` and `acceptOffer`, so a directly
   * assigned job is technically on `/expedion` for the duration of this call.
   * Accepted rather than engineered around: `commitAward` requires `open` and
   * takes a row lock, so a bid landing inside that window is rejected by the
   * award like any other losing bid. A "never really on the market" flag would
   * mean a migration, a second predicate in `browse` and a listing state
   * `acceptOffer` would have to learn — for a window measured in milliseconds.
   *
   * The driver is told by `acceptOffer`'s own notification. Its wording says
   * their offer was accepted, which is the shape this borrows rather than a
   * claim they bid.
   *
   * @param carrierId a `carriers.id`, as the operator's picker yields it —
   *   `offers.carrier_id` is a user id, and the two are mapped here.
   * @param actorUserId the operator awarding. `acceptOffer` checks the
   *   `operator`/`admin` role itself, so a shared-key caller with no account
   *   behind it is refused there.
   */
  async assignDirect(
    quoteId: string,
    carrierId: string,
    actorUserId: string
  ) {
    const quote = await expedionDal.getById(quoteId);
    if (!quote) throw err("QUOTE_NOT_FOUND", 404);
    if (quote.paymentStatus !== "paid") {
      throw err(
        "QUOTE_NOT_PAID",
        409,
        "A driver may only be assigned once the client has paid"
      );
    }
    if (quote.listingId) {
      throw err("ALREADY_ESCALATED", 409, "This quote is already on Expeditoo");
    }

    // The driver is checked before anything is created. Discovering an
    // unusable carrier after `escalate` has run would leave the job on the
    // marketplace as a side effect of an assignment that never happened.
    const carrier = await carriersDal.getById(carrierId);
    if (!carrier || carrier.status !== "approved") {
      throw err(
        "CARRIER_NOT_APPROVED",
        409,
        "This driver is not approved to carry work"
      );
    }
    const vehicle =
      carrier.vehicles.find((v) => v.isActive) ?? carrier.vehicles[0];
    if (!vehicle) {
      throw err(
        "CARRIER_HAS_NO_VEHICLE",
        409,
        "This driver has no vehicle on file, and an offer must name one"
      );
    }

    // The actor's authority is settled BEFORE anything is published.
    // `acceptOffer` checks it too, but by then `escalate` has already put the
    // job on the marketplace — so a caller who cannot award (the shared-key
    // path, where `userId` is whatever `x-expedion-uid` claimed and no account
    // stands behind it) would have escalated a quote as a side effect of an
    // assignment that was always going to be refused.
    const [isOperator, isAdmin] = await Promise.all([
      userHasRole(actorUserId, "operator"),
      userHasRole(actorUserId, "admin"),
    ]);
    if (!isOperator && !isAdmin) {
      throw err(
        "FORBIDDEN_NOT_OPERATOR",
        403,
        "Awarding a job needs an operator or admin account, not a shared key"
      );
    }

    // Status, blockers and the escalation claim are all `escalate`'s checks;
    // repeating them here would be a second copy that drifts.
    const { listing } = await this.escalate(quoteId, {
      reason: "Chauffeur attribué directement par la supervision",
      actor: "admin",
      directAssignment: true,
    });

    // Past this point the job is on the marketplace. Anything that fails is
    // reported as itself rather than as a 500, because the states differ in
    // what the operator should do next — a vehicle too small is a different
    // driver, a declined hold is a payment problem, and either way the job is
    // now live and awaiting a bid rather than lost.
    try {
      // Through the offers service, not the DAL: `submitOffer` is what checks
      // the vehicle can legally carry the load (`assertOfferFitsJob`), that the
      // vehicle belongs to this carrier, and that the carrier is approved — and
      // it is what maintains `listings.offers_count`. Writing the row directly
      // skipped all four.
      const offer = await offersService.submitOffer(carrier.userId, listing.id, {
        vehicleId: vehicle.id,
        // What the client already paid. There is no negotiation on this lane,
        // so there is nothing to bid down to.
        priceCents: quote.acceptedPriceCents!,
        // No slot is proposed on this lane: nobody bid, so there is nothing to
        // choose between and the job keeps its own window
        // (offer_time_slots_spec.md §3.4).
        slots: [],
        deliveryLeadDays: 0,
        tzOffset: 0,
        message: "Course attribuée directement, sans mise en concurrence.",
      });

      // Everything real happens here: the hold, the shipment, the write-back
      // that puts the driver's name on the client's screen.
      const award = await offersService.acceptOffer(actorUserId, offer.id);

      return { listing, offer, shipment: award.shipment };
    } catch (cause) {
      throw asExpedionError(cause, listing.id);
    }
  },

  /**
   * The auto-escalate sweep. Returns a per-quote outcome so the cron response
   * says what happened rather than just how many rows it touched.
   */
  async runAutoEscalation(now = new Date(), limit = 50) {
    const due = await expedionDal.findDueForEscalation(now, limit);
    const results: {
      quoteId: string;
      escalated: boolean;
      listingId?: string;
      error?: string;
    }[] = [];

    for (const quote of due) {
      try {
        const { listing } = await this.escalate(quote.id, {
          reason: "Délai d'attribution dépassé : mise en concurrence automatique",
        });
        results.push({ quoteId: quote.id, escalated: true, listingId: listing.id });
      } catch (error) {
        results.push({
          quoteId: quote.id,
          escalated: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      considered: due.length,
      escalated: results.filter((r) => r.escalated).length,
      failed: results.filter((r) => !r.escalated).length,
      results,
    };
  }
};
