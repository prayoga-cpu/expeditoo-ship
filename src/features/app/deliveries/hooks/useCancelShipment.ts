"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/fetcher";
import type { CancellationCategory } from "@/lib/cancellation-policy";
import { deliveriesApi } from "../api/deliveries.api";

/**
 * The requester calls the job off.
 *
 * Cancelling **refunds** — there has been no hold to release since the client
 * started paying at booking, and the copy that said otherwise was wrong for as
 * long as it stood. Allowed only before the goods are collected; past that the
 * service answers `CANCEL_REQUIRES_SUPPORT`.
 *
 * A transporter never reaches this. Their verb is `withdraw`, which leaves the
 * client's job alive, and the service says so by name.
 */
export function useCancelShipment() {
  const t = useTranslations("deliveries.cancelFeedback");
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      category,
      reason,
    }: {
      id: string;
      category: CancellationCategory;
      reason?: string;
    }) => deliveriesApi.cancel(id, { category, reason }),
    onSuccess: () => {
      toast.success(t("success"));
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
    },
    onError: (error) => {
      const code = error instanceof ApiError ? error.code : "";
      toast.error(messageFor(code, error, t));
    },
  });
}

function messageFor(
  code: string,
  error: unknown,
  t: ReturnType<typeof useTranslations>
): string {
  switch (code) {
    case "CANCEL_REQUIRES_SUPPORT":
      return t("requiresSupport");
    case "USE_WITHDRAW_ENDPOINT":
      return t("useWithdraw");
    case "CANCEL_SYSTEM_ACCOUNT_FORBIDDEN":
      return t("systemAccount");
    case "CATEGORY_NOT_FOR_SIDE":
      return t("badCategory");
    default:
      return error instanceof Error ? error.message : t("failed");
  }
}
