import { api, toQuery } from "@/lib/fetcher";
import type { Job, BrowseResult, DraftJob, OffersResponse } from "../types";

export interface BrowseParams {
  categoryId?: string;
  q?: string;
  origin?: "direct" | "expedion";
  /** Where the driver starts, and where they are going on a corridor search. */
  fromLat?: number;
  fromLng?: number;
  toLat?: number;
  toLng?: number;
  /** Étapes as `lat,lng` pairs joined by `;`. */
  via?: string;
  /** Radius around the departure, or half-width of the corridor. */
  radiusKm?: number;
  minBudget?: number;
  maxBudget?: number;
  maxWeightKg?: number;
  /** `YYYY-MM-DD` days, comma-joined by `toQuery`. */
  days?: string[];
  slots?: string[];
  tzOffset?: number;
  sort?: string;
  page?: number;
  limit?: number;
}

export const listingsApi = {
  browse: (params: BrowseParams = {}) =>
    api.get<BrowseResult>(`/api/listings${toQuery(params)}`),

  getById: (id: string) => api.get<Job>(`/api/listings/${id}`),

  getOffers: (listingId: string, sort = "price_asc") =>
    api.get<OffersResponse>(
      `/api/listings/${listingId}/offers${toQuery({ sort })}`
    ),

  mine: (status?: string) =>
    api.get<Job[]>(`/api/listings/me${toQuery({ status })}`),

  /** A request not yet live, everything included, to finish it. */
  getDraft: (id: string) => api.get<DraftJob>(`/api/listings/${id}/draft`),

  /** Gone for good: nobody but its author has seen it. */
  deleteDraft: (id: string) =>
    api.delete<{ deleted: true }>(`/api/listings/${id}/draft`),

  /** A scheduled request back to a draft. */
  unschedule: (id: string) => api.post<DraftJob>(`/api/listings/${id}/unschedule`),
};
