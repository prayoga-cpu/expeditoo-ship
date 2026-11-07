"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, toQuery } from "@/lib/fetcher";
import type { BordereauRow } from "@/server/dal/expedion-bordereaux.dal";

export interface BordereauPage {
  rows: BordereauRow[];
  total: number;
  page: number;
  limit: number;
}

/** The flat slip table, a page at a time; search and pager change the key. */
export function useBordereaux(params: { q?: string; page: number; limit: number }) {
  return useQuery({
    queryKey: ["admin", "bordereaux", params],
    queryFn: () => api.get<BordereauPage>(`/api/admin/expedion/bordereaux${toQuery(params)}`),
    placeholderData: keepPreviousData,
  });
}
