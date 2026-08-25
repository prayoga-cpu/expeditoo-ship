"use client";

import { useQuery } from "@tanstack/react-query";
import { listingsApi } from "@/features/app/listing/api/listings.api";
import type { ListingStatus } from "@/features/app/listing/types";

/** The caller's own jobs, optionally narrowed to one status. */
export function useMyJobs(status?: ListingStatus) {
  return useQuery({
    queryKey: ["my-jobs", status ?? "all"],
    queryFn: () => listingsApi.mine(status),
  });
}
