"use client";

import { useQuery } from "@tanstack/react-query";
import { recentRequestsApi } from "../api/recent-requests.api";

export const recentRequestsKey = ["public", "recent-requests"] as const;

/**
 * The newest open requests. Read in the browser, after the page has painted:
 * the landing is a static page served from the edge, and reading the
 * database while rendering it would make every visit dynamic — or run the
 * read at `next build` (landing_2026_11_spec.md §4.3). The endpoint is cached
 * for a minute; so is this.
 */
export function useRecentRequests() {
  return useQuery({
    queryKey: recentRequestsKey,
    queryFn: recentRequestsApi.list,
    staleTime: 60_000,
  });
}
