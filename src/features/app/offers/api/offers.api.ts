import { api, toQuery } from "@/lib/fetcher";
import type { TimeSlot } from "@/lib/availability-window";
import type { Offer } from "@/features/app/listing/types";

export interface SubmitOfferInput {
  vehicleId: string;
  priceCents: number;
  /** The days and times of day the carrier can do the job. At least one. */
  slots: { day: string; slot: TimeSlot }[];
  /** 0 = delivered the same day, 1 = J+1. */
  deliveryLeadDays: number;
  /** `getTimezoneOffset()`, so "matin" reaches the server as the driver's. */
  tzOffset: number;
  message?: string;
}

/**
 * What accepting or taking answers: the offer as its own row — no carrier,
 * vehicle or slots beside it — and the shipment by id
 * (offers_engine_spec.md §5).
 */
export interface AcceptOfferResult {
  offer: Omit<Offer, "carrier" | "vehicle" | "slots">;
  shipment: { id: string } | null;
  alreadyAccepted: boolean;
}

/** What accepting would debit now — `GET /api/offers/:id/payment`. */
export interface PaymentQuote {
  /** False when nothing is charged here: paid in Expedion, or test mode. */
  required: boolean;
  reason: "charge" | "mock" | "prepaid";
  priceCents: number;
  platformFeeCents: number;
  totalCents: number;
  savedCard: { brand: string; last4: string } | null;
}

export interface PreparePaymentInput {
  method: "saved" | "new";
  saveCard?: boolean;
  slotId?: string;
}

/** An intent authorised for this award, or one still waiting on the card. */
export interface PreparedPayment {
  paymentIntentId: string;
  status: string;
  clientSecret: string | null;
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

  /**
   * `slotId` books one of the carrier's proposed slots; absent takes the
   * earliest. `paymentIntentId` is the card just authorised in the payment
   * dialog, which the award captures.
   */
  accept: (offerId: string, slotId?: string, paymentIntentId?: string) =>
    api.post<AcceptOfferResult>(`/api/offers/${offerId}/accept`, {
      slotId,
      paymentIntentId,
    }),

  paymentQuote: (offerId: string, slotId?: string) =>
    api.get<PaymentQuote>(
      `/api/offers/${offerId}/payment${toQuery({ slotId })}`
    ),

  preparePayment: (offerId: string, input: PreparePaymentInput) =>
    api.post<PreparedPayment>(`/api/offers/${offerId}/payment`, input),

  withdraw: (offerId: string) =>
    api.post<Offer>(`/api/offers/${offerId}/withdraw`),

  mine: (params: { status?: string; page?: number; limit?: number } = {}) =>
    api.get<Offer[]>(`/api/carrier/offers${toQuery(params)}`),
};
