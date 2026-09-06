import { z } from "zod";

// ========================================
// Carrier Discovery DTO
// ========================================
// What a requester may learn about a carrier whose declared trajet covers their
// job: the nine fields of docs/specs/carriers_on_route_spec.md §4.3, and a
// tenth is a spec change rather than an implementation detail.
//
// The schema is the privacy boundary, not a formality. The service parses the
// whole match row through it — geometry, capacity, the carrier row, the user
// id — so `parse` drops everything the projection does not name. A private
// column added to the DAL read a year from now cannot reach the wire by
// somebody forgetting to strip it here.

export const carrierMatchSchema = z.object({
  /**
   * `carrier_routes.id`. Opaque to the client and the only handle it gets: it
   * addresses the contact endpoint, which resolves the carrier's user id
   * server-side, so no requester is ever handed one (spec §6.2).
   */
  matchId: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  rating: z.number(),
  reviewCount: z.number(),
  /** Cities, never addresses or postal codes — the precedent the public
   *  confirmation payload set (transport_status_confirmation_spec.md). */
  originCity: z.string(),
  destinationCity: z.string(),
  /** Runs already clipped to the job's pickup window, soonest first. */
  nextRuns: z.array(z.string()),
  /** Kilometres off the trajet, rounded: the worse of the job's two ends. */
  detourKm: z.number(),
});

export const carrierMatchListSchema = z.object({
  items: z.array(carrierMatchSchema),
  /** Distinct carriers before the display cap — the number in the tab badge. */
  total: z.number().int().nonnegative(),
});

export type CarrierMatch = z.infer<typeof carrierMatchSchema>;
export type CarrierMatchList = z.infer<typeof carrierMatchListSchema>;
