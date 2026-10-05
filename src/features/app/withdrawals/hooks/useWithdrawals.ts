"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { ApiError } from "@/lib/fetcher";
import {
  withdrawalsApi,
  type DecideInput,
} from "../api/withdrawals.api";

export function useWithdrawalBalance() {
  return useQuery({
    queryKey: ["withdrawals", "balance"],
    queryFn: withdrawalsApi.balance,
  });
}

export function useRequestWithdrawal() {
  const queryClient = useQueryClient();
  const t = useTranslations("withdrawals");

  return useMutation({
    mutationFn: withdrawalsApi.request,
    onSuccess: () => {
      toast.success(t("requested"));
      queryClient.invalidateQueries({ queryKey: ["withdrawals"] });
    },
    onError: (error) => {
      const code = error instanceof ApiError ? error.code : "";
      const known = [
        "WITHDRAWAL_ALREADY_OPEN",
        "NOTHING_TO_WITHDRAW",
        "BELOW_MINIMUM",
        // The balance moved between the read and the claim (a refund, or a
        // second request) — payout_safety_spec.md §4.
        "WITHDRAWAL_BALANCE_CHANGED",
      ];
      toast.error(known.includes(code) ? t(`errors.${code}`) : t("errors.generic"));
    },
  });
}

export function useWithdrawalQueue(status?: string) {
  return useQuery({
    queryKey: ["withdrawals", "review", status ?? "all"],
    queryFn: () => withdrawalsApi.review(status),
  });
}

/**
 * `onStatusChanged` runs when a colleague's decision moved the request on
 * meanwhile: the queue then shows it where it now is (payout_safety_spec.md §4).
 */
export function useDecideWithdrawal({ onStatusChanged }: { onStatusChanged?: () => void } = {}) {
  const queryClient = useQueryClient();
  const t = useTranslations("withdrawals");

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: DecideInput }) =>
      withdrawalsApi.decide(id, input),
    onSuccess: (_data, variables) => {
      toast.success(t(`decided.${variables.input.action}`));
      queryClient.invalidateQueries({ queryKey: ["withdrawals"] });
    },
    onError: (error) => {
      const code = error instanceof ApiError ? error.code : "";
      const known = [
        "REFERENCE_REQUIRED",
        "WITHDRAWAL_ALREADY_SETTLED",
        "WITHDRAWAL_NOT_REQUESTED",
        // Named rather than generic: it tells the operator what to do next —
        // refuse the request (payout_safety_spec.md §4).
        "WITHDRAWAL_HAS_INVALID_PAYOUT",
        // A colleague decided first: the queue is read again, and the caller
        // shows the request where it now is.
        "WITHDRAWAL_STATUS_CHANGED",
      ];
      toast.error(known.includes(code) ? t(`errors.${code}`) : t("errors.generic"));
      if (code === "WITHDRAWAL_STATUS_CHANGED" || code === "WITHDRAWAL_ALREADY_SETTLED") {
        queryClient.invalidateQueries({ queryKey: ["withdrawals"] });
      }
      if (code === "WITHDRAWAL_STATUS_CHANGED") onStatusChanged?.();
    },
  });
}
