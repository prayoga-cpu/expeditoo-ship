"use client";

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/fetcher";
import { listingsApi } from "../api/listings.api";
import { jobKeys } from "./useJobDetail";
import type { Job } from "../types";

/**
 * Why the server refused to touch a request that had not gone live, as the
 * `myJobs.draft` key that says so — each true whatever happened in between
 * (draft_requests_spec.md §4). Null for any other failure, which is worth a
 * retry; none of these is.
 */
export function draftRefusal(error: unknown) {
  if (!(error instanceof ApiError)) return null;
  // Deleted meanwhile, in another tab.
  if (error.status === 404) return "notFound" as const;
  // Un-scheduled, published or expired meanwhile: not scheduled, whatever it is.
  if (error.code === "LISTING_NOT_SCHEDULED") return "notScheduled" as const;
  // Published or closed meanwhile — live, expired or cancelled.
  if (error.code === "LISTING_NOT_DRAFT") return "noLongerEditable" as const;
  return null;
}

/**
 * Deleting and un-scheduling a request that has not gone live
 * (docs/specs/draft_requests_spec.md §4). Resuming and publishing go through
 * the form, so they are links, not mutations.
 *
 * Both refresh the requester's list; `settle` decides what becomes of the
 * request's own page. A refusal refreshes both, so the screen shows what the
 * request is now rather than what this tab last read.
 */
function useDraftMutation<T>(
  action: (id: string) => Promise<T>,
  doneKey: "deleted" | "unscheduled",
  settle: (queryClient: QueryClient, id: string, result: T) => void,
  onDone?: () => void
) {
  const queryClient = useQueryClient();
  const t = useTranslations("myJobs.draft");

  return useMutation({
    mutationFn: action,
    onSuccess: (result, id) => {
      toast.success(t(doneKey));
      queryClient.invalidateQueries({ queryKey: ["my-jobs"] });
      settle(queryClient, id, result);
      onDone?.();
    },
    onError: (error, id) => {
      const refusal = draftRefusal(error);
      toast.error(t(refusal ?? "failed"));
      if (!refusal) return;
      queryClient.invalidateQueries({ queryKey: ["my-jobs"] });
      queryClient.invalidateQueries({ queryKey: jobKeys.detail(id) });
    },
  });
}

/** Gone: its page is left (`onDone`), and no cache may serve it again. */
export const useDeleteDraft = (onDone?: () => void) =>
  useDraftMutation(
    listingsApi.deleteDraft,
    "deleted",
    (queryClient, id) => queryClient.removeQueries({ queryKey: jobKeys.detail(id) }),
    onDone
  );

/**
 * Its page stays open on it, so the copy that page observes is rewritten in
 * place, then re-read. Removing it instead re-rendered nobody: the page went
 * on saying « Planifiée » beside a toast saying the opposite.
 */
export const useUnschedule = (onDone?: () => void) =>
  useDraftMutation(
    listingsApi.unschedule,
    "unscheduled",
    (queryClient, id, draft) => {
      // The endpoint returns the row, not its photos or category: those are
      // kept from the copy already held.
      queryClient.setQueryData<Job>(jobKeys.detail(id), (held) =>
        held ? { ...held, ...draft } : held
      );
      queryClient.invalidateQueries({ queryKey: jobKeys.detail(id) });
    },
    onDone
  );
