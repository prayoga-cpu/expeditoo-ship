import {
  carrierRoutesDal,
  type NotifyCandidateRow,
} from "@/server/dal/carrier-routes.dal";
import { notificationsService } from "@/server/services/notifications.service";
import {
  MAX_MATCH_CANDIDATES,
  matchRoute,
  type MatchTarget,
} from "@/lib/route-match";
import type { Listing } from "@/db/schema/listings";

// ========================================
// Carrier Route Alerts Service
// ========================================
// Wires `carrier_routes.notify_on_match`: persisted since 0010, read by
// nothing until now (carrier_trips_spec.md §9, carriers_on_route_spec.md §8).
// When a listing reaches the board, a carrier who declared a trajet covering
// it and asked to be alerted gets a notification. Not a second copy of the
// corridor test — `matchRoute` is the same predicate
// `carrier-discovery.service.ts` runs the other way (carriers_on_route_spec.md
// §3.6), so a job either produces the discovery card, this alert, both, or
// neither, from one answer. See carrier_route_alerts_spec.md.

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

/**
 * `null` for a listing posted with a manually-typed address and no map pin —
 * there is no proximity to alert anyone about, and nothing downstream throws
 * on a null coordinate, it would just silently fail to match every trajet,
 * ever.
 */
function jobFor(listing: Listing): MatchTarget | null {
  if (
    listing.pickupLat === null ||
    listing.pickupLng === null ||
    listing.dropoffLat === null ||
    listing.dropoffLng === null
  ) {
    return null;
  }
  return {
    pickup: { lat: listing.pickupLat, lng: listing.pickupLng },
    dropoff: { lat: listing.dropoffLat, lng: listing.dropoffLng },
    pickupFrom: listing.pickupFrom,
    pickupUntil: listing.pickupUntil,
    weightKg: listing.weightKg,
  };
}

/** One notification per carrier, even when several of their trajets match. */
function dedupeByCarrier(rows: NotifyCandidateRow[]): NotifyCandidateRow[] {
  const seen = new Map<string, NotifyCandidateRow>();
  for (const row of rows) {
    if (!seen.has(row.userId)) seen.set(row.userId, row);
  }
  return [...seen.values()];
}

export const carrierRouteAlertsService = {
  /**
   * Fired once a listing is genuinely open for any carrier to act on — see
   * §3 of the spec for exactly which call sites that is and, just as
   * importantly, which one (`assignDirect`) it is not.
   *
   * Best-effort throughout: the candidate lookup runs inside the caller's own
   * `.catch()` (matching `sendListingPostedEmail`'s convention), and each
   * notification swallows its own failure so one bad row never stops the
   * rest.
   */
  async notifyMatchingCarriers(listing: Listing): Promise<void> {
    const job = jobFor(listing);
    if (!job) return;

    const now = new Date();

    const candidates = await carrierRoutesDal.findNotifyCandidates(
      {
        pickup: job.pickup,
        dropoff: job.dropoff,
        weightKg: job.weightKg,
        windowStart: startOfDay(
          now > listing.pickupFrom ? now : listing.pickupFrom
        ),
        windowEnd: listing.pickupUntil,
      },
      MAX_MATCH_CANDIDATES
    );

    const matched = candidates.filter(
      (row) =>
        // A shipper who is also an approved carrier does not get alerted
        // about their own job — the same self-match guard
        // `carrier-discovery.service.ts` applies.
        row.userId !== listing.shipperId && matchRoute(row, job, now) !== null
    );

    for (const carrier of dedupeByCarrier(matched)) {
      // A second, account-level consent alongside the per-trajet
      // `notify_on_match` switch already filtered for above — the Settings
      // checkbox decides whether the account hears about a match once one
      // fires (notification_channel_settings_spec.md §5).
      if (
        carrier.userPreferences?.notifications?.inApp?.carrierRouteMatch ===
        false
      ) {
        continue;
      }

      await notificationsService
        .createNotification({
          userId: carrier.userId,
          type: "carrier_route_match",
          title: "Une course correspond à votre trajet",
          message: `"${listing.title}" : ${listing.pickupCity} → ${listing.dropoffCity}.`,
          linkUrl: `/listing/${listing.id}`,
          data: { listingId: listing.id, routeId: carrier.routeId },
        })
        .catch((e) =>
          console.error("carrier_route_match notification failed", e)
        );
    }
  },
};
