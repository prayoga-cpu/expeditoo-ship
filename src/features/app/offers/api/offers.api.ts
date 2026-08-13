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

export const offersApi = {
  submit: (listingId: string, input: SubmitOfferInput) =>
    api.post<Offer>(`/api/listings/${listingId}/offers`, input),

  accept: (offerId: string) =>
    api.post<AcceptOfferResult>(`/api/offers/${offerId}/accept`),

  withdraw: (offerId: string) =>
    api.post<Offer>(`/api/offers/${offerId}/withdraw`),

  mine: (params: { status?: string; page?: number; limit?: number } = {}) =>
    api.get<Offer[]>(`/api/carrier/offers${toQuery(params)}`),
};
