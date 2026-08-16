import { api, toQuery } from "@/lib/fetcher";
import type { Job, BrowseResult, OffersResponse } from "../types";

export interface BrowseParams {
  categoryId?: string;
  q?: string;
  origin?: "direct" | "expedion";
  nearLat?: number;
  nearLng?: number;
  radiusKm?: number;
  minBudget?: number;
  maxBudget?: number;
  maxWeightKg?: number;
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

  cancel: (id: string) => api.delete<{ deleted: boolean }>(`/api/listings/${id}`),
};
