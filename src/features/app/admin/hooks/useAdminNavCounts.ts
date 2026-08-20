import { useQuery } from "@tanstack/react-query";

import type { AdminNavCounts } from "@/server/services/admin-nav.service";

/**
 * The sidebar badge counts.
 *
 * Polled rather than pushed: the numbers change when a client pays, a driver
 * applies or a quote passes its escalation deadline, none of which this browser
 * is party to. A minute of staleness on a badge is invisible; a websocket per
 * admin tab to carry nine integers is not worth it.
 *
 * `refetchOnWindowFocus` is on here — the opposite of the report's setting —
 * because coming back to the tab is exactly when "did anything arrive?" is the
 * question being asked.
 */
export function useAdminNavCounts() {
  const { data } = useQuery<AdminNavCounts>({
    queryKey: ["admin", "nav-counts"],
    queryFn: async () => {
      const response = await fetch("/api/admin/nav-counts");
      // Text-then-parse: a route that dies before answering replies with an
      // HTML error page, and `response.json()` would surface that as a parse
      // error about "<" rather than as "the badges could not be read".
      const raw = await response.text();
      let body: { success: boolean; data?: AdminNavCounts } | null = null;
      try {
        body = JSON.parse(raw) as { success: boolean; data?: AdminNavCounts };
      } catch {
        body = null;
      }
      // A failure leaves the badges off rather than throwing: the sidebar has
      // to render on a page whose own data loaded fine.
      if (!body || !response.ok || !body.success || !body.data) {
        throw new Error("Nav counts unavailable");
      }
      return body.data;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1,
  });

  return data;
}
