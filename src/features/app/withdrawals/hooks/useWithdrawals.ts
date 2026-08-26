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

export function useDecideWithdrawal() {
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
      ];
      toast.error(known.includes(code) ? t(`errors.${code}`) : t("errors.generic"));
    },
  });
}
