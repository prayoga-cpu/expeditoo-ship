"use client";

import { useState } from "react";

import { DEFAULT_RADIUS_KM, type JobFilters } from "../types";

/**
 * The part of the board's filters the search card owns: where, when, and the
 * title (board_route_search_spec.md §12). Budget, weight and the sort stay
 * live controls under the card.
 */
export type SearchDraft = Pick<
  JobFilters,
  "q" | "from" | "to" | "via" | "radiusKm" | "days" | "slots"
>;

export const EMPTY_SEARCH: SearchDraft = {
  q: "",
  from: null,
  to: null,
  via: [],
  radiusKm: null,
  days: [],
  slots: [],
};

export const searchOf = (filters: JobFilters): SearchDraft => ({
  q: filters.q,
  from: filters.from,
  to: filters.to,
  via: filters.via,
  radiusKm: filters.radiusKm,
  days: filters.days,
  slots: filters.slots,
});

/**
 * A destination with no departure describes neither a circle nor a corridor
 * (§2), and the board would quietly stop filtering on place. The card says so
 * and waits instead of sending it.
 */
export const needsDeparture = (draft: SearchDraft) =>
  draft.from === null && draft.to !== null;

/** What « Rechercher » sends: the draft, tidied. */
export function committedSearch(draft: SearchDraft): SearchDraft {
  return {
    ...draft,
    q: draft.q.trim(),
    // A place with no radius would filter nothing; a radius with no place
    // means nothing.
    radiusKm: draft.from ? (draft.radiusKm ?? DEFAULT_RADIUS_KM) : null,
    via: draft.to ? draft.via : [],
  };
}

/**
 * The search card's fields, held apart from the board until « Rechercher ».
 *
 * The board used to refilter on every field change, which is what made the
 * search read as a row of loose controls. One button now asks the question;
 * the URL is written when it is pressed, as before (§6).
 *
 * Seeded once from the committed filters — a deep link from a declared trip
 * opens with its trajet in the fields. The board remounts the card (by `key`)
 * when it clears everything from outside.
 */
export function useSearchDraft(
  filters: JobFilters,
  onSearch: (search: SearchDraft) => void,
  onClear: () => void
) {
  const [draft, setDraft] = useState<SearchDraft>(() => searchOf(filters));
  const [departureMissing, setDepartureMissing] = useState(false);

  const patch = (change: Partial<SearchDraft>) => {
    setDraft((current) => ({ ...current, ...change }));
    if (change.from || change.to === null) setDepartureMissing(false);
  };

  const submit = () => {
    if (needsDeparture(draft)) {
      setDepartureMissing(true);
      return;
    }
    setDepartureMissing(false);
    onSearch(committedSearch(draft));
  };

  const clear = () => {
    setDraft(EMPTY_SEARCH);
    setDepartureMissing(false);
    onClear();
  };

  return { draft, patch, submit, clear, departureMissing };
}
