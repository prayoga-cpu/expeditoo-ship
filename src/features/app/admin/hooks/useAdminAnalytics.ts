import { useQuery } from "@tanstack/react-query";
import type { DashboardStatsData, ActivityItem } from "@/server/dto/admin.dto";

// ========================================
// Types for API Response
// ========================================

interface StatsApiResponse {
  success: boolean;
  data?: DashboardStatsData;
  error?: {
    code: string;
    message: string;
  };
}

interface ActivityApiResponse {
  success: boolean;
  data?: ActivityItem[];
  error?: {
    code: string;
    message: string;
  };
}

// ========================================
// Fetch Functions
// ========================================

async function fetchAdminStats(): Promise<DashboardStatsData> {
  const response = await fetch("/api/admin/stats");
  const json: StatsApiResponse = await response.json();

  if (!response.ok || !json.success) {
    throw new Error(json.error?.message || "Failed to fetch admin stats");
  }

  return json.data!;
}

async function fetchAdminActivity(): Promise<ActivityItem[]> {
  const response = await fetch("/api/admin/activity");
  const json: ActivityApiResponse = await response.json();

  if (!response.ok || !json.success) {
    throw new Error(json.error?.message || "Failed to fetch admin activity");
  }

  return json.data!;
}

// ========================================
// Hooks
// ========================================

/**
 * Hook to fetch admin dashboard statistics
 */
export function useAdminStats() {
  return useQuery({
    queryKey: ["admin", "stats"],
    queryFn: fetchAdminStats,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

/**
 * Hook to fetch admin activity feed
 */
export function useAdminActivity() {
  return useQuery({
    queryKey: ["admin", "activity"],
    queryFn: fetchAdminActivity,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}
