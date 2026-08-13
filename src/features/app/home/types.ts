/**
 * Job board types.
 *
 * The board shows transport jobs open for bidding, so a row is a route with a
 * load and a budget - not an item with a price.
 */

import type { Job } from "@/features/app/listing/types";

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
  nearLat: number | null;
  nearLng: number | null;
  radiusKm: number | null;
  sort: JobSort;
}

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
  nearLat: null,
  nearLng: null,
  radiusKm: null,
  sort: "created_desc",
};
