"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/fetcher";
import { confirmApi } from "../api/confirm.api";

/**
 * The landing page's data.
 *
 * `retry: false` on purpose: an expired or forged token answers 410 and will
 * answer 410 again, so retrying only delays the page that explains it. The
 * `isError` branch is mandatory here — a hook that resolves to nothing renders
 * a blank page (CLAUDE.md gotcha 9), and this one is opened from an SMS by
 * someone with no other way to find out what happened.
 */
export function useConfirmationSubject(token: string) {
  const query = useQuery({
    queryKey: ["confirmation", token],
    queryFn: () => confirmApi.describe(token),
    retry: false,
    enabled: Boolean(token),
  });

  return {
    subject: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    /** A dead link is a distinct outcome from a server that fell over. */
    isInvalidToken:
      query.error instanceof ApiError && query.error.code === "INVALID_TOKEN",
  };
}

export function useSubmitConfirmation(token: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (note?: string) => confirmApi.submit(token, note),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["confirmation", token] });
    },
  });

  return {
    submit: () => mutation.mutate(undefined),
    isPending: mutation.isPending,
    isDone: mutation.isSuccess,
    isError: mutation.isError,
  };
}
