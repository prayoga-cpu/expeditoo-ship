"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  offersApi,
  type SubmitOfferInput,
  type TakeJobInput,
} from "../api/offers.api";
import { ApiError } from "@/lib/fetcher";

/**
 * The service's error codes a carrier can act on, each with a message under
 * `listing.bid.submitErrors`. They were an English map until 2.65.0, so a
 * French driver read « The bidding window for this job has closed » (client
 * feedback 2026-10-21, §D4).
 */
const SUBMIT_CODES = [
  "SLOTS_REQUIRED",
  "SLOT_IN_PAST",
  "SLOT_DUPLICATE",
  "SLOT_DAY_INVALID",
  "TOO_MANY_SLOTS",
  "TOO_MANY_SLOT_DAYS",
  "DELIVERY_LEAD_OUT_OF_RANGE",
  "CARRIER_NOT_APPROVED",
  "LISTING_NOT_OPEN",
  "LISTING_EXPIRED",
  "OFFER_ALREADY_EXISTS",
  "CANNOT_BID_OWN_LISTING",
  "VEHICLE_CAPACITY_WEIGHT",
  "VEHICLE_CAPACITY_DIMENSIONS",
  "PICKUP_OUTSIDE_WINDOW",
] as const;

const isSubmitCode = (code: string): code is (typeof SUBMIT_CODES)[number] =>
  (SUBMIT_CODES as readonly string[]).includes(code);

export function useMyOffers(status?: string) {
  return useQuery({
    queryKey: ["carrier-offers", status ?? "all"],
    queryFn: () => offersApi.mine({ status }),
  });
}

export function useSubmitOffer(listingId: string) {
  const queryClient = useQueryClient();
  const t = useTranslations("listing.bid");

  return useMutation({
    mutationFn: (input: SubmitOfferInput) => offersApi.submit(listingId, input),
    onSuccess: () => {
      toast.success(t("toast.submitted"), {
        description: t("toast.submittedDescription"),
      });
      queryClient.invalidateQueries({ queryKey: ["job", listingId] });
      queryClient.invalidateQueries({ queryKey: ["carrier-offers"] });
    },
    onError: (error) => {
      // A DTO refusal arrives as VALIDATION_ERROR with the real code buried in
      // `issues[].message` (api-response.ts), so reading `error.code` alone
      // showed the carrier "Invalid input" for every slot rule they broke.
      const coded =
        error instanceof ApiError
          ? [error.code, ...(error.issues ?? []).map((issue) => issue.message)]
          : [];

      const known = coded.find(isSubmitCode);

      toast.error(
        known ? t(`submitErrors.${known}`) : t("toast.submitFailed")
      );
    },
  });
}

export function useWithdrawOffer() {
  const queryClient = useQueryClient();
  const t = useTranslations("listing.bid");

  return useMutation({
    mutationFn: (offerId: string) => offersApi.withdraw(offerId),
    onSuccess: () => {
      toast.success(t("toast.withdrawn"));
      queryClient.invalidateQueries({ queryKey: ["carrier-offers"] });
    },
    onError: () => toast.error(t("toast.withdrawFailed")),
  });
}

/**
 * Take a job outright.
 *
 * The error worth naming is LISTING_NOT_OPEN: two drivers tapping at the same
 * moment is the expected case, and the loser needs to be told somebody beat
 * them to it rather than shown a generic failure. TAKE_NOT_AVAILABLE is a
 * direct request, where the panel is not shown at all (take_job_spec.md);
 * named anyway, so a refusal that does arrive points the driver at the offer
 * form rather than reading as a failure. Messages go through next-intl rather
 * than the hardcoded English map above, which predates it.
 */
export function useTakeJob(listingId: string) {
  const queryClient = useQueryClient();
  const t = useTranslations("listing.bid");

  return useMutation({
    mutationFn: (input: TakeJobInput) => offersApi.take(listingId, input),
    onSuccess: () => {
      toast.success(t("takeSuccess"));
      queryClient.invalidateQueries({ queryKey: ["job", listingId] });
      queryClient.invalidateQueries({ queryKey: ["carrier-offers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => {
      const code = error instanceof ApiError ? error.code : "";
      const known = [
        "LISTING_NOT_OPEN",
        "LISTING_EXPIRED",
        "CARRIER_NOT_APPROVED",
        "VEHICLE_CAPACITY_WEIGHT",
        "VEHICLE_CAPACITY_DIMENSIONS",
        "OFFER_ALREADY_EXISTS",
        "TAKE_NOT_AVAILABLE",
      ];
      toast.error(
        known.includes(code) ? t(`errors.${code}`) : t("errors.generic")
      );
    },
  });
}
