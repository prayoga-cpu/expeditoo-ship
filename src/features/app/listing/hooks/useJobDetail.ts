"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { listingsApi } from "../api/listings.api";
import { offersApi } from "@/features/app/offers/api/offers.api";
import { ApiError } from "@/lib/fetcher";

export const jobKeys = {
  detail: (id: string) => ["job", id] as const,
  offers: (id: string, sort: string) => ["job", id, "offers", sort] as const,
  carriers: (id: string) => ["job", id, "carriers"] as const,
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
  const t = useTranslations("myJobs.detail.accept");

  return useMutation({
    mutationFn: ({ offerId, slotId }: { offerId: string; slotId?: string }) =>
      offersApi.accept(offerId, slotId),
    onSuccess: (result) => {
      // Not "payment authorised": what happens next depends on the inlet. A
      // direct job is charged here, an escalated one was already paid in
      // Expedion and is never charged again (payment_at_booking_spec.md), so
      // the toast names the thing both have in common.
      toast.success(t(result.alreadyAccepted ? "alreadyAccepted" : "awarded"));
      queryClient.invalidateQueries({ queryKey: ["job", listingId] });
    },
    onError: (error) => {
      const message =
        error instanceof ApiError && error.code === "LISTING_ALREADY_AWARDED"
          ? t("alreadyAwarded")
          : error instanceof ApiError && error.code === "PAYMENT_METHOD_REQUIRED"
            ? t("paymentMethodRequired")
            : error instanceof Error
              ? error.message
              : t("failed");
      toast.error(message);
    },
  });
}
