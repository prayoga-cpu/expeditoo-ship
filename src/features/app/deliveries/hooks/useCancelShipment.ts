"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/fetcher";
import { deliveriesApi } from "../api/deliveries.api";

/**
 * Cancelling releases the held payment (never captured), so the service only
 * allows it before pickup - once goods are moving it answers
 * CANCEL_REQUIRES_SUPPORT.
 */
export function useCancelShipment() {
  const t = useTranslations("deliveries.cancelFeedback");
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      deliveriesApi.cancel(id, reason),
    onSuccess: () => {
      toast.success(t("success"));
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
    },
    onError: (error) => {
      const code = error instanceof ApiError ? error.code : "";
      toast.error(
        code === "CANCEL_REQUIRES_SUPPORT"
          ? t("requiresSupport")
          : error instanceof Error
            ? error.message
            : t("failed")
      );
    },
  });
}
