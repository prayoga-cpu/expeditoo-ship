/**
 * Admin client API for listings (transport jobs, every status and inlet).
 *
 * Mirrors `GET /api/admin/listings`, whose rows are the listing with its
 * shipper joined (`listingsDal.adminList`). Only the fields the admin surfaces
 * read are typed here.
 */

import { api, toQuery } from "@/lib/fetcher";
import type { ListingStatus } from "@/features/app/listing/types";

export type ListingOrigin = "direct" | "expedion";

export interface AdminListingRow {
  id: string;
  title: string;
  status: ListingStatus;
  origin: ListingOrigin;
  budgetCents: number;
  pickupCity: string;
  dropoffCity: string;
  views: number;
  createdAt: string;
  shipper?: { name?: string | null; email?: string | null } | null;
}

export interface AdminListingsPage {
  items: AdminListingRow[];
  total: number;
}

export interface AdminListingsParams {
  status?: ListingStatus;
  /** Absent means both inlets. */
  origin?: ListingOrigin;
  page?: number;
  limit?: number;
}

export const adminListingsApi = {
  list: (params: AdminListingsParams = {}) =>
    api.get<AdminListingsPage>(`/api/admin/listings${toQuery(params)}`),

  remove: (id: string) => api.delete<unknown>(`/api/listings/${id}`),
};
