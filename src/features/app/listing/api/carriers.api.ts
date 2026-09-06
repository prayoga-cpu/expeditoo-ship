import { api } from "@/lib/fetcher";

/**
 * Client API for the carriers whose declared trajet covers a job
 * (docs/specs/carriers_on_route_spec.md §6).
 *
 * The shape is the whole projection the requester is allowed to see: nine
 * fields, no address, no coordinates, no vehicle and — above all — no user id.
 * Contact travels by `matchId`, which the server re-matches before it will
 * reach anybody, so this client cannot be used to walk a carrier directory.
 */

export interface CarrierMatch {
  /** `carrier_routes.id`, opaque here and re-validated server-side. */
  matchId: string;
  displayName: string;
  avatarUrl: string | null;
  rating: number;
  reviewCount: number;
  originCity: string;
  destinationCity: string;
  /** ISO instants, already clipped to the job's pickup window, at most three. */
  nextRuns: string[];
  detourKm: number;
}

export interface CarrierMatchList {
  items: CarrierMatch[];
  /** Distinct carriers, not trajets — this is the number in the tab badge. */
  total: number;
}

export const listingCarriersApi = {
  list: (listingId: string) =>
    api.get<CarrierMatchList>(`/api/listings/${listingId}/carriers`),

  contact: (listingId: string, matchId: string) =>
    api.post<{ conversationId: string }>(
      `/api/listings/${listingId}/carriers/${matchId}/contact`
    ),
};
