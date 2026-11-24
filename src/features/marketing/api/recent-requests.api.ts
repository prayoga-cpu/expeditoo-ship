import { api } from "@/lib/fetcher";
import type { RecentRequestList } from "@/server/dto/recent-requests.dto";

/** « Demandes récentes » — public, cached a minute at the edge (landing_2026_11_spec.md §4). */
export const recentRequestsApi = {
  list: () => api.get<RecentRequestList>("/api/public/recent-requests"),
};
