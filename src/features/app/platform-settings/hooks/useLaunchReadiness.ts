"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { platformSettingsApi } from "../api/platform-settings.api";

export const launchReadinessKeys = {
  company: ["company-identity"] as const,
  stripe: ["stripe-status"] as const,
};

export function useCompanyIdentity() {
  return useQuery({
    queryKey: launchReadinessKeys.company,
    queryFn: platformSettingsApi.getCompany,
  });
}

/** Toasts are the panel's to show: it knows which field a refusal names. */
export function useUpdateCompanyIdentity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: platformSettingsApi.updateCompany,
    onSuccess: (data) => {
      queryClient.setQueryData(launchReadinessKeys.company, data);
    },
  });
}

export function useStripeStatus() {
  return useQuery({
    queryKey: launchReadinessKeys.stripe,
    queryFn: platformSettingsApi.getStripeStatus,
    // Asks Stripe on every fetch; a background refetch on focus is noise.
    refetchOnWindowFocus: false,
  });
}
