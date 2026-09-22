"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { platformSettingsApi } from "../api/platform-settings.api";

export const platformSettingsKeys = { all: ["platform-settings"] as const };

export function usePlatformSettings() {
  return useQuery({
    queryKey: platformSettingsKeys.all,
    queryFn: platformSettingsApi.get,
  });
}

export function useUpdatePlatformSettings() {
  const queryClient = useQueryClient();
  const t = useTranslations("platformSettings");

  return useMutation({
    mutationFn: platformSettingsApi.update,
    onSuccess: () => {
      toast.success(t("saved"));
      queryClient.invalidateQueries({ queryKey: platformSettingsKeys.all });
    },
    onError: () => {
      toast.error(t("saveFailed"));
    },
  });
}
