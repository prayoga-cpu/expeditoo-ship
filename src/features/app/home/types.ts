/**
 * Job board types.
 *
 * The board shows transport jobs open for bidding, so a row is a route with a
 * load and a budget - not an item with a price.
 */

import type { Job } from "@/features/app/listing/types";
import type { TimeSlot } from "@/lib/availability-window";

export type BoardJob = Job & {
  /** Set for a signed-in driver, so the board can mark work already bid on. */
  hasBid?: boolean;
};

export interface JobFilters {
  q: string;
  categoryId: string | null;
  /** Euros, as entered; converted to cents at the API boundary. */
  minBudget: number | null;
  maxBudget: number | null;
  maxWeightKg: number | null;
  /** Where the driver starts. Null until a city is chosen from the suggestions. */
  from: PlaceValue | null;
  /** Where they are going. Null in "autour de", which has no arrival field. */
  to: PlaceValue | null;
  radiusKm: number | null;
  /** The days the driver can drive, `YYYY-MM-DD`. */
  days: string[];
  /** Times of day within those days. Empty means the whole day. */
  slots: TimeSlot[];
  sort: JobSort;
}

/** A place the driver picked out of the city suggestions. */
export interface PlaceValue {
  label: string;
  lat: number;
  lng: number;
}

/**
 * Which shape the location filter takes. Held in the UI only — the query
 * derives its mode from whether an arrival is present
 * (board_route_search_spec.md §2).
 */
export type SearchMode = "around" | "route";

/** Cocolis offers 5–200 km; these are the four a French driver actually picks. */
export const RADIUS_OPTIONS = [25, 50, 100, 200] as const;

export const DEFAULT_RADIUS_KM = 50;

export type JobSort =
  | "created_desc"
  | "budget_desc"
  | "budget_asc"
  | "pickup_asc"
  | "distance_asc";

export const DEFAULT_JOB_FILTERS: JobFilters = {
  q: "",
  categoryId: null,
  minBudget: null,
  maxBudget: null,
  maxWeightKg: null,
  from: null,
  to: null,
  radiusKm: null,
  days: [],
  slots: [],
  sort: "created_desc",
};
