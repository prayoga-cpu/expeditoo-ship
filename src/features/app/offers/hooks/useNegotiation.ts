"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { ApiError } from "@/lib/fetcher";
import { offersApi } from "../api/offers.api";

/**
 * Expeditoo's pick and the counter-price loop on one offer
 * (client_feedback_2026_10_29_spec.md §B1, §B6). Every success refetches the
 * job and the carrier's pending list, so both sides read the same price.
 */

const KNOWN = [
  "OFFER_NOT_PENDING",
  "LISTING_NOT_OPEN",
  "PROPOSAL_NOT_AVAILABLE",
  "CARRIER_ABSENT",
  "COUNTER_PENDING",
  "COUNTER_LIMIT_REACHED",
  "COUNTER_SAME_PRICE",
  "COUNTER_NOT_AVAILABLE",
  "NO_COUNTER_PENDING",
  "PRICE_OUT_OF_RANGE",
];

function useNegotiationMutation<TInput>(
  run: (input: TInput) => Promise<unknown>,
  successKey: (input: TInput) => string
) {
  const queryClient = useQueryClient();
  const t = useTranslations("negotiation.toast");

  return useMutation({
    mutationFn: run,
    onSuccess: (_data, input) => {
      toast.success(t(successKey(input)));
      queryClient.invalidateQueries({ queryKey: ["job"] });
      queryClient.invalidateQueries({ queryKey: ["carrier-offers"] });
    },
    onError: (error) => {
      const code = error instanceof ApiError ? error.code : "";
      toast.error(KNOWN.includes(code) ? t(`errors.${code}`) : t("errors.generic"));
    },
  });
}

export function useProposeOffer() {
  return useNegotiationMutation(
    ({ offerId, propose }: { offerId: string; propose: boolean }) =>
      propose ? offersApi.propose(offerId) : offersApi.unpropose(offerId),
    ({ propose }) => (propose ? "proposed" : "unproposed")
  );
}

export function useCounterOffer() {
  return useNegotiationMutation(
    ({ offerId, priceCents, note }: { offerId: string; priceCents: number; note: string | null }) =>
      offersApi.counter(offerId, priceCents, note),
    () => "countered"
  );
}

export type CounterAnswer =
  | { action: "accept" }
  | { action: "decline" }
  | { action: "revise"; priceCents: number };

export function useRespondToCounter() {
  return useNegotiationMutation(
    ({ offerId, answer }: { offerId: string; answer: CounterAnswer }) =>
      offersApi.respondToCounter(offerId, answer),
    ({ answer }) => `answered.${answer.action}`
  );
}
