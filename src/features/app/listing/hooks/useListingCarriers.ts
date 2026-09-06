"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/fetcher";
import { listingCarriersApi } from "../api/carriers.api";
import { jobKeys } from "./useJobDetail";

type Translate = (key: string) => string;

/**
 * The server's `code` decides the sentence; the raw message is the last resort.
 * Mirrors `describe` in `useCarrierTrips` so both surfaces read the same way.
 *
 * Every code `carrierDiscoveryService` can throw is named here. An unmapped one
 * falls through to `error.message`, and a `CarrierDiscoveryError` carries its
 * own code as its message — so a gap in this table puts the literal string
 * `CONTACT_FAILED` in front of a user.
 */
function describe(error: unknown, t: Translate, fallbackKey: string): string {
  const code = error instanceof ApiError ? error.code : "";
  const known: Record<string, string> = {
    LISTING_NOT_FOUND: "errors.listingNotFound",
    CONTACT_FAILED: "errors.contactFailed",
    MATCH_NOT_FOUND: "errors.matchNotFound",
    LISTING_NOT_OPEN: "errors.listingNotOpen",
    NOT_LISTING_OWNER: "errors.notListingOwner",
    CONTACT_RATE_LIMITED: "errors.rateLimited",
  };

  if (known[code]) return t(known[code]);
  if (error instanceof Error && error.message) return error.message;
  return t(fallbackKey);
}

/**
 * The carriers whose declared trajet covers this job.
 *
 * The react-query result is returned whole rather than destructured down to
 * `data`: the panel has to branch on `isError`, and a hook that answers `null`
 * on failure renders a blank page with nothing to retry (CLAUDE.md gotcha 9).
 */
export function useListingCarriers(listingId: string, enabled = true) {
  return useQuery({
    queryKey: jobKeys.carriers(listingId),
    queryFn: () => listingCarriersApi.list(listingId),
    enabled: enabled && Boolean(listingId),
  });
}

/**
 * Opening the conversation is the whole action: the server writes one message
 * on the job's thread and answers with its id, so the tap lands the requester
 * where the carrier will reply.
 */
export function useContactCarrier(listingId: string) {
  const t = useTranslations("myJobs.carriers");
  const router = useRouter();

  return useMutation({
    mutationFn: (matchId: string) =>
      listingCarriersApi.contact(listingId, matchId),
    onSuccess: ({ conversationId }) =>
      router.push(`/messages/${conversationId}`),
    onError: (error) => toast.error(describe(error, t, "errors.contactFailed")),
  });
}
