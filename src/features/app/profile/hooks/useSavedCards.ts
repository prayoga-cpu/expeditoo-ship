"use client";

import { useQuery } from "@tanstack/react-query";
import { paymentMethodsApi } from "../api/payment-methods.api";

export const savedCardsKeys = { all: ["saved-cards"] as const };

export function useSavedCards() {
  return useQuery({
    queryKey: savedCardsKeys.all,
    queryFn: paymentMethodsApi.list,
  });
}
