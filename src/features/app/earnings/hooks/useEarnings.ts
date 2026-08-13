"use client";

import { useQuery } from "@tanstack/react-query";
import type { EarningSourceType } from "@/db/schema/earnings";

interface EarningItem {
  id: string;
  amount: number;
  currency: string;
  source: EarningSourceType;
  status: string;
  description: string | null;
  createdAt: string;
  order: {
    id: string;
    listing: {
      id: string;
      title: string;
    } | null;
  } | null;
}

interface EarningsSummary {
  sale: { amount: number; count: number };
  delivery: { amount: number; count: number };
  total: { amount: number; count: number };
}

interface EarningsResponse {
  success: boolean;
  data: EarningItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

interface SummaryResponse {
  success: boolean;
  data: EarningsSummary;
}

async function fetchEarnings(
  limit: number,
  offset: number,
  source?: EarningSourceType
): Promise<EarningsResponse> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (source) params.set("source", source);

  const res = await fetch(`/api/earnings?${params}`);
  return res.json();
}

async function fetchSummary(): Promise<SummaryResponse> {
  const res = await fetch("/api/earnings/summary");
  return res.json();
}

export function useEarnings(
  options: {
    limit?: number;
    offset?: number;
    source?: EarningSourceType;
  } = {}
) {
  const { limit = 20, offset = 0, source } = options;

  return useQuery({
    queryKey: ["earnings", limit, offset, source],
    queryFn: () => fetchEarnings(limit, offset, source),
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useEarningsSummary() {
  return useQuery({
    queryKey: ["earnings-summary"],
    queryFn: fetchSummary,
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useStripeDashboard() {
  const openDashboard = async () => {
    try {
      const res = await fetch("/api/stripe/connect/dashboard");
      const data = await res.json();
      if (data.success && data.data.url) {
        window.open(data.data.url, "_blank");
      } else {
        throw new Error(data.error || "Failed to open dashboard");
      }
    } catch (error) {
      console.error("Failed to open Stripe dashboard:", error);
      throw error;
    }
  };

  return { openDashboard };
}

export type { EarningItem, EarningsSummary };
