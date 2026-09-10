"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { ApiError } from "@/lib/fetcher";
import { feedbackApi } from "../api/feedback.api";
import type {
  FeedbackQuery,
  SubmitFeedbackInput,
  TriageFeedbackInput,
} from "@/server/dto/feedback.dto";

/**
 * Every surface here exposes `isError` rather than collapsing failure to an
 * empty list: a query hook that returns null on failure renders a blank page,
 * which is exactly how the withdrawals 500 stayed invisible (CLAUDE.md
 * §Gotchas 9).
 */

export function useSubmitFeedback() {
  const t = useTranslations("feedback.toast");
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SubmitFeedbackInput) => feedbackApi.submit(input),
    onSuccess: () => {
      toast.success(t("sent"));
      queryClient.invalidateQueries({ queryKey: ["feedback", "mine"] });
    },
    onError: (error) => {
      const code = error instanceof ApiError ? error.code : "";
      toast.error(code === "FEEDBACK_RATE_LIMITED" ? t("rateLimited") : t("failed"));
    },
  });
}

/** `enabled` is false while the history tab is hidden — do not fetch it unseen. */
export function useMyFeedback(enabled = true) {
  const query = useQuery({
    queryKey: ["feedback", "mine"],
    queryFn: () => feedbackApi.listMine(),
    enabled,
  });

  return {
    feedback: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

export function useFeedbackQueue(params: Partial<FeedbackQuery>) {
  const query = useQuery({
    queryKey: ["feedback", "queue", params],
    queryFn: () => feedbackApi.queue(params),
    // Two people triaging at once otherwise overwrite each other's view, and
    // coming back to the tab is exactly when "did anything arrive?" is the
    // question — the same reasoning `useAdminNavCounts` records.
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  return {
    items: query.data?.items ?? [],
    meta: query.data?.meta,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function useTriageFeedback() {
  const t = useTranslations("feedback.toast");
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TriageFeedbackInput }) =>
      feedbackApi.triage(id, input),
    onSuccess: (_data, variables) => {
      toast.success(
        variables.input.devNote !== undefined ? t("noteSaved") : t("triaged")
      );
      queryClient.invalidateQueries({ queryKey: ["feedback", "queue"] });
      // The sidebar badge counts OPEN + NEEDS_REVIEW, so triage moves it.
      queryClient.invalidateQueries({ queryKey: ["admin", "nav-counts"] });
    },
    onError: () => toast.error(t("failed")),
  });
}
