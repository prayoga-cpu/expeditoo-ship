"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useDebounce } from "use-debounce";
import { listingsApi } from "@/features/app/listing/api/listings.api";
import {
  isAvailabilityDay,
  MAX_AVAILABILITY_DAYS,
  TIME_SLOTS,
  type TimeSlot,
} from "@/lib/availability-window";
import {
  DEFAULT_JOB_FILTERS,
  type JobFilters,
  type JobSort,
  type PlaceValue,
} from "../types";

/**
 * Drives the job board.
 *
 * Budgets are entered in euros and sent in cents, because the API works in
 * cents throughout and converting at the boundary keeps the rounding in one
 * place.
 *
 * `origin` pins the board to one inlet. Both inlets are live again, so the
 * board passes nothing and shows everything; narrowing it stays a one-word
 * change.
 *
 * **The filters live in the URL.** They did not, which is why
 * `routeMatchHref` — the "voir les courses correspondantes" link on a declared
 * trip — produced a query the board silently ignored. Seeding from
 * `useSearchParams` fixes that link, makes a search shareable and lets it
 * survive a reload (board_route_search_spec.md §6).
 */
export function useJobBoard(options: { origin?: "direct" | "expedion" } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Seeded once. The URL is written from state after that, never read back
  // into it, so a round trip cannot fight the user mid-keystroke.
  const [filters, setFilters] = useState<JobFilters>(() =>
    filtersFromParams(searchParams)
  );
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
      fromLat: filters.from?.lat,
      fromLng: filters.from?.lng,
      toLat: filters.to?.lat,
      toLng: filters.to?.lng,
      // A point with no radius filters nothing; default rather than drop it, so
      // choosing a city always narrows the board.
      radiusKm: filters.from ? (filters.radiusKm ?? undefined) : undefined,
      days: filters.days.length > 0 ? filters.days : undefined,
      slots: filters.slots.length > 0 ? filters.slots : undefined,
      // Sent alongside the days so a slot means the driver's hour, not the
      // server's — production runs TZ=UTC.
      tzOffset:
        filters.days.length > 0 ? new Date().getTimezoneOffset() : undefined,
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

  const writeUrl = useCallback(
    (next: JobFilters) => {
      const search = paramsFromFilters(next).toString();
      router.replace(search ? `${pathname}?${search}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router]
  );

  const updateFilters = (patch: Partial<JobFilters>) => {
    // Computed outside the updater: React may run an updater during render,
    // and `router.replace` from there warns that a component is being updated
    // while another renders. Filter changes are user-driven, so reading the
    // current filters from the closure is safe.
    const next = { ...filters, ...patch };
    setFilters(next);
    writeUrl(next);
    setPage(1);
  };

  const resetFilters = () => {
    setFilters(DEFAULT_JOB_FILTERS);
    writeUrl(DEFAULT_JOB_FILTERS);
    setPage(1);
  };

  const activeFilterCount = [
    filters.categoryId,
    filters.minBudget,
    filters.maxBudget,
    filters.maxWeightKg,
    filters.from,
    filters.days.length > 0 ? filters.days : null,
  ].filter((value) => value !== null).length;

  return {
    jobs: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    filters,
    updateFilters,
    resetFilters,
    activeFilterCount,
    page,
    setPage,
  };
}

// ---- URL <-> filters ----------------------------------------------------
// Exported for the tests, which assert the round trip rather than the
// rendering.

const SORTS: JobSort[] = [
  "created_desc",
  "budget_desc",
  "budget_asc",
  "pickup_asc",
  "distance_asc",
];

export function filtersFromParams(params: URLSearchParams): JobFilters {
  const place = (prefix: "from" | "to"): PlaceValue | null => {
    const lat = Number(params.get(`${prefix}Lat`));
    const lng = Number(params.get(`${prefix}Lng`));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (!params.get(`${prefix}Lat`) || !params.get(`${prefix}Lng`)) return null;

    // A deep link carries coordinates; the label is a convenience the trip card
    // supplies and the board falls back to rendering the point.
    return {
      label: params.get(`${prefix}Label`) ?? formatPoint(lat, lng),
      lat,
      lng,
    };
  };

  const number = (key: string) => {
    const raw = params.get(key);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  };

  const from = place("from");
  const sort = params.get("sort");

  return {
    ...DEFAULT_JOB_FILTERS,
    q: params.get("q") ?? "",
    minBudget: number("minBudget"),
    maxBudget: number("maxBudget"),
    maxWeightKg: number("maxWeightKg"),
    from,
    to: from ? place("to") : null,
    radiusKm: number("radiusKm"),
    days: (params.get("days") ?? "")
      .split(",")
      .filter(isAvailabilityDay)
      .slice(0, MAX_AVAILABILITY_DAYS),
    slots: (params.get("slots") ?? "")
      .split(",")
      .filter((slot): slot is TimeSlot =>
        TIME_SLOTS.includes(slot as TimeSlot)
      ),
    sort: SORTS.includes(sort as JobSort) ? (sort as JobSort) : "created_desc",
  };
}

export function paramsFromFilters(filters: JobFilters): URLSearchParams {
  const params = new URLSearchParams();
  const set = (key: string, value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === "") return;
    params.set(key, String(value));
  };

  set("q", filters.q);
  set("minBudget", filters.minBudget);
  set("maxBudget", filters.maxBudget);
  set("maxWeightKg", filters.maxWeightKg);

  if (filters.from) {
    set("fromLat", filters.from.lat);
    set("fromLng", filters.from.lng);
    set("fromLabel", filters.from.label);
    set("radiusKm", filters.radiusKm);

    // Only meaningful alongside a departure: an arrival on its own describes no
    // corridor.
    if (filters.to) {
      set("toLat", filters.to.lat);
      set("toLng", filters.to.lng);
      set("toLabel", filters.to.label);
    }
  }

  if (filters.days.length > 0) {
    set("days", filters.days.join(","));
    if (filters.slots.length > 0) set("slots", filters.slots.join(","));
  }

  if (filters.sort !== "created_desc") set("sort", filters.sort);

  return params;
}

/** What a deep link without a label shows in the city field. */
const formatPoint = (lat: number, lng: number) =>
  `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
