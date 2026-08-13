"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { offersApi, type SubmitOfferInput } from "../api/offers.api";
import { ApiError } from "@/lib/fetcher";

/** Maps the service's error codes to something a carrier can act on. */
const SUBMIT_MESSAGES: Record<string, string> = {
  CARRIER_NOT_APPROVED: "Your carrier application is not approved yet",
  LISTING_NOT_OPEN: "This job is no longer accepting offers",
  LISTING_EXPIRED: "The bidding window for this job has closed",
  OFFER_ALREADY_EXISTS: "You already have a live offer on this job",
  CANNOT_BID_OWN_LISTING: "You cannot bid on your own job",
  VEHICLE_CAPACITY_WEIGHT: "That vehicle cannot carry this load",
  VEHICLE_CAPACITY_DIMENSIONS: "That vehicle is too small for this load",
  PICKUP_OUTSIDE_WINDOW: "Your pickup time is outside the shipper's window",
};

export function useMyOffers(status?: string) {
  return useQuery({
    queryKey: ["carrier-offers", status ?? "all"],
    queryFn: () => offersApi.mine({ status }),
  });
}

export function useSubmitOffer(listingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SubmitOfferInput) => offersApi.submit(listingId, input),
    onSuccess: () => {
      toast.success("Offer submitted");
      queryClient.invalidateQueries({ queryKey: ["job", listingId] });
      queryClient.invalidateQueries({ queryKey: ["carrier-offers"] });
    },
    onError: (error) => {
      const code = error instanceof ApiError ? error.code : "";
      toast.error(
        SUBMIT_MESSAGES[code] ??
          (error instanceof Error ? error.message : "Could not submit offer")
      );
    },
  });
}

export function useWithdrawOffer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (offerId: string) => offersApi.withdraw(offerId),
    onSuccess: () => {
      toast.success("Offer withdrawn");
      queryClient.invalidateQueries({ queryKey: ["carrier-offers"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not withdraw"),
  });
}
