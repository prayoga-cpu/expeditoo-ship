import { api, toQuery } from "@/lib/fetcher";
import type { Offer } from "@/features/app/listing/types";

export interface SubmitOfferInput {
  vehicleId: string;
  priceCents: number;
  estimatedPickup: string;
  estimatedDelivery: string;
  message?: string;
}

export interface AcceptOfferResult {
  offer: Offer;
  shipment: { id: string } | null;
  alreadyAccepted: boolean;
}

export interface TakeJobInput {
  vehicleId: string;
  message?: string;
}

export const offersApi = {
  submit: (listingId: string, input: SubmitOfferInput) =>
    api.post<Offer>(`/api/listings/${listingId}/offers`, input),

  /**
   * Take a job outright at the posted budget. No price is sent — the server
   * uses `listing.budgetCents`, so the client cannot name its own.
   */
  take: (listingId: string, input: TakeJobInput) =>
    api.post<AcceptOfferResult>(`/api/listings/${listingId}/take`, input),

  /** Operator-only: hand an awarded job back to the board. */
  revokeAward: (listingId: string, reason?: string) =>
    api.post<{ listingId: string; offerId: string }>(
      `/api/listings/${listingId}/revoke-award`,
      { reason }
    ),

  accept: (offerId: string) =>
    api.post<AcceptOfferResult>(`/api/offers/${offerId}/accept`),

  withdraw: (offerId: string) =>
    api.post<Offer>(`/api/offers/${offerId}/withdraw`),

  mine: (params: { status?: string; page?: number; limit?: number } = {}) =>
    api.get<Offer[]>(`/api/carrier/offers${toQuery(params)}`),
};
