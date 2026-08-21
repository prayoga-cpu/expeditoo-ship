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
import { expedionDal } from "@/server/dal/expedion.dal";
import { listingsService } from "@/server/services/listings.service";
import { listingsDal } from "@/server/dal/listings.dal";
import { expedionSmsService } from "@/server/services/expedion-sms.service";
import { notifyExpedionAdmins } from "@/server/services/expedion-realtime.service";
import {
  ExpedionError,
  canTransition,
} from "@/server/services/expedion.service";
import type { ExpedionQuote } from "@/db/schema/expedion";

const err = (code: string, status: number, message?: string) =>
  new ExpedionError(code, status, message);

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
  const configured = process.env.EXPEDION_CATEGORY_ID;
  if (configured) return configured;

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
    opts: { reason?: string; actor?: string } = {}
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
        }));

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
          { status: "escalated", listingId: listing.id },
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

      void expedionSmsService
        .deliveryUpdate({
          phone: updated.phone,
          status: "escalated",
          bordereauNumber: updated.bordereauNumber,
        })
        .catch(() => undefined);

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
