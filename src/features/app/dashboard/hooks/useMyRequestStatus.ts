"use client";

import { useQuery } from "@tanstack/react-query";
import { listingsApi } from "@/features/app/listing/api/listings.api";
import { myRequestKeys } from "@/features/app/listing/hooks/useMyRequests";
import { featuredRequest } from "../myRequestStatus";

/**
 * The caller's own most relevant request, if they have one.
 *
 * Shares `myRequestKeys.list()` with `/listings/me` on purpose, so a caller
 * who visits both is served from one cache entry rather than two identical
 * fetches (listing_posted_feedback_spec.md §2.4).
 */
export function useMyRequestStatus() {
  const query = useQuery({
    queryKey: myRequestKeys.list(),
    queryFn: () => listingsApi.mine(),
  });

  return {
    featured: featuredRequest(query.data ?? []),
    isLoading: query.isLoading,
  };
}
