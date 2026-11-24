import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { listings } from "@/db/schema/listings";

/**
 * The newest open requests, for the public landing page
 * (docs/specs/landing_2026_11_spec.md §4).
 *
 * Its own read rather than `listingsDal.browse`: the board joins the
 * requester's whole `user` row and every photo, and an anonymous, cached read
 * has no business loading either. Only the columns a card can carry are
 * selected, and the service still runs the public projection over them.
 *
 * "Open" is the board's own rule — `status = 'open'` and not yet past
 * `expires_at` — so a job the expiry cron has not reached yet never shows
 * here after it has stopped taking offers. Newest means most recently
 * *published*, as on the board (draft_requests_spec.md §5), with the unique
 * reference settling ties.
 */
export const recentRequestsDal = {
  async latestOpen(limit: number, now: Date) {
    return db
      .select({
        id: listings.id,
        reference: listings.reference,
        status: listings.status,
        title: listings.title,
        jobKind: listings.jobKind,
        pickupCity: listings.pickupCity,
        pickupCountry: listings.pickupCountry,
        dropoffCity: listings.dropoffCity,
        dropoffCountry: listings.dropoffCountry,
        pickupFrom: listings.pickupFrom,
        pickupUntil: listings.pickupUntil,
        isFlexible: listings.isFlexible,
        weightKg: listings.weightKg,
        movingSurfaceM2: listings.movingSurfaceM2,
        movingVolumeM3: listings.movingVolumeM3,
      })
      .from(listings)
      // A typed operator, never a `Date` inside a raw `sql` template
      // (CLAUDE.md gotcha 23).
      .where(and(eq(listings.status, "open"), gte(listings.expiresAt, now)))
      .orderBy(
        desc(sql`coalesce(${listings.publishedAt}, ${listings.createdAt})`),
        desc(listings.reference)
      )
      .limit(limit);
  },
};
