"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/fetcher";
import { listingsApi } from "../api/listings.api";
import { jobKeys } from "./useJobDetail";

/** Refusals that are true whatever happened meanwhile, each with its own copy. */
const KNOWN = [
  "LISTING_NOT_OPEN",
  "LISTING_NOT_CANCELLABLE",
  "CANCEL_VIA_SHIPMENT",
  "LISTING_NOT_ENDED",
] as const;

const knownCode = (error: unknown) =>
  error instanceof ApiError
    ? KNOWN.find((code) => code === error.code) ?? null
    : null;

/**
 * What a requester does with a request that is live or has ended
 * (docs/specs/no_dead_ends_spec.md §2–3). Each refusal says why and re-reads
 * the request, so the page shows what it now is rather than what this tab last
 * read; a refusal that a run now exists also points at the delivery, where the
 * cancel lives.
 */
function useRequestMutation<T>(
  action: (id: string) => Promise<T>,
  onDone: (id: string, result: T) => void
) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const t = useTranslations("myJobs.owner");

  const refresh = (id: string) => {
    queryClient.invalidateQueries({ queryKey: ["my-jobs"] });
    queryClient.invalidateQueries({ queryKey: jobKeys.detail(id) });
  };

  return useMutation({
    mutationFn: action,
    onSuccess: (result, id) => {
      refresh(id);
      onDone(id, result);
    },
    onError: (error, id) => {
      const code = knownCode(error);
      if (code) refresh(id);
      toast.error(t(`errors.${code ?? "generic"}`), {
        action:
          code === "CANCEL_VIA_SHIPMENT" || code === "LISTING_NOT_OPEN"
            ? { label: t("trackDelivery"), onClick: () => router.push("/deliveries") }
            : undefined,
      });
    },
  });
}

/** Off the board and into the form, which is where a request is published. */
export function useEditLiveRequest() {
  const router = useRouter();
  const t = useTranslations("myJobs.owner");
  return useRequestMutation(listingsApi.unpublish, (id) => {
    toast.success(t("done.unpublished"));
    router.push(`/create?draft=${id}`);
  });
}

export function useCancelRequest() {
  const t = useTranslations("myJobs.owner");
  return useRequestMutation(listingsApi.cancel, () => toast.success(t("done.cancelled")));
}

/** A fresh draft, opened in the form: its dates are almost certainly past. */
export function useRepostRequest() {
  const router = useRouter();
  const t = useTranslations("myJobs.owner");
  return useRequestMutation(listingsApi.repost, (_id, draft) => {
    toast.success(t("done.reposted"));
    router.push(`/create?draft=${draft.id}`);
  });
}
