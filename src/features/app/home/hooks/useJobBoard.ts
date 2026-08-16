"use client";

import { useState, useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useDebounce } from "use-debounce";
import { listingsApi } from "@/features/app/listing/api/listings.api";
import { DEFAULT_JOB_FILTERS, type JobFilters } from "../types";

/**
 * Drives the job board.
 *
 * Budgets are entered in euros and sent in cents, because the API works in
 * cents throughout and converting at the boundary keeps the rounding in one
 * place.
 *
 * `origin` pins the board to one inlet. Expedion escalation is the only source
 * of demand now, so the board passes `expedion` and legacy `direct` rows — left
 * over from the shipper-posting era, or seeded — stay off the carrier's list.
 */
export function useJobBoard(options: { origin?: "direct" | "expedion" } = {}) {
  const [filters, setFilters] = useState<JobFilters>(DEFAULT_JOB_FILTERS);
  const [page, setPage] = useState(1);

  // Typing should not fire a request per keystroke.
  const [debouncedQuery] = useDebounce(filters.q, 350);

  const params = useMemo(
    () => ({
      q: debouncedQuery || undefined,
      origin: options.origin,
      categoryId: filters.categoryId ?? undefined,
      minBudget: filters.minBudget != null ? filters.minBudget * 100 : undefined,
      maxBudget: filters.maxBudget != null ? filters.maxBudget * 100 : undefined,
      maxWeightKg: filters.maxWeightKg ?? undefined,
      nearLat: filters.nearLat ?? undefined,
      nearLng: filters.nearLng ?? undefined,
      radiusKm: filters.radiusKm ?? undefined,
      sort: filters.sort,
      page,
      limit: 20,
    }),
    [debouncedQuery, filters, page, options.origin]
  );

  const query = useQuery({
    queryKey: ["jobs", params],
    queryFn: () => listingsApi.browse(params),
    // Keeps the previous page on screen while the next loads, instead of
    // collapsing the board to a spinner on every filter change.
    placeholderData: keepPreviousData,
  });

  const updateFilters = (patch: Partial<JobFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  };

  const resetFilters = () => {
    setFilters(DEFAULT_JOB_FILTERS);
    setPage(1);
  };

  const activeFilterCount = [
    filters.categoryId,
    filters.minBudget,
    filters.maxBudget,
    filters.maxWeightKg,
    filters.radiusKm,
  ].filter((v) => v !== null).length;

  return {
    jobs: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    filters,
    updateFilters,
    resetFilters,
    activeFilterCount,
    page,
    setPage,
  };
}
