"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listingsApi } from "../api/listings.api";
import { offersApi } from "@/features/app/offers/api/offers.api";
import { ApiError } from "@/lib/fetcher";

export const jobKeys = {
  detail: (id: string) => ["job", id] as const,
  offers: (id: string, sort: string) => ["job", id, "offers", sort] as const,
};

export function useJobDetail(listingId: string) {
  return useQuery({
    queryKey: jobKeys.detail(listingId),
    queryFn: () => listingsApi.getById(listingId),
    enabled: Boolean(listingId),
  });
}

export function useJobOffers(listingId: string, sort = "price_asc") {
  return useQuery({
    queryKey: jobKeys.offers(listingId, sort),
    queryFn: () => listingsApi.getOffers(listingId, sort),
    enabled: Boolean(listingId),
  });
}

/**
 * Accepting is the point of no return for the shipper: it awards the job,
 * rejects the other carriers and authorises payment. Both the job and its
 * offers are refetched so the UI reflects the new award immediately.
 */
export function useAcceptOffer(listingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (offerId: string) => offersApi.accept(offerId),
    onSuccess: (result) => {
      toast.success(
        result.alreadyAccepted
          ? "This offer was already accepted"
          : "Carrier selected - payment authorised"
      );
      queryClient.invalidateQueries({ queryKey: ["job", listingId] });
    },
    onError: (error) => {
      const message =
        error instanceof ApiError && error.code === "LISTING_ALREADY_AWARDED"
          ? "Another offer was just accepted for this job"
          : error instanceof ApiError && error.code === "PAYMENT_METHOD_REQUIRED"
            ? "Add a payment method before accepting an offer"
            : error instanceof Error
              ? error.message
              : "Could not accept this offer";
      toast.error(message);
    },
  });
}
