"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/fetcher";
import { searchAddress } from "@/lib/geocoding";
import {
  canLocate,
  itemCount,
  parcelFor,
  suggestedRange,
  type SuggestionEnd,
  type SuggestionInput,
} from "../price-suggestion";

/**
 * Where an end is, for the estimate only: its pin, or — typed by hand — its
 * address looked up in its own country, then its postal code and town. The
 * point is never written to the form; a request posted without a pin is
 * placed by the server (client_feedback_2026_10_31_spec.md §4).
 */
async function pointOf(end: SuggestionEnd): Promise<{ lat: number; lng: number } | null> {
  if (end.lat != null && end.lng != null) return { lat: end.lat, lng: end.lng };
  const town = [end.postalCode, end.city].filter((p) => p?.trim()).join(" ");
  const queries = [[end.address, town].filter((p) => p?.trim()).join(", "), town].filter(
    (query, i, all) => query.trim().length >= 3 && all.indexOf(query) === i
  );
  for (const query of queries) {
    const [hit] = await searchAddress(query, (end.country ?? "FR").toLowerCase(), 1);
    if (hit) return { lat: hit.center[1], lng: hit.center[0] };
  }
  return null;
}

/** Only what decides where an end is: typing a contact name refetches nothing. */
const place = (end: SuggestionEnd) => [
  end.lat ?? null,
  end.lng ?? null,
  end.lat != null ? null : (end.address ?? ""),
  end.postalCode ?? "",
  end.city ?? "",
  end.country ?? "FR",
];

/**
 * The suggested range for the request as typed so far (§B6), or null. A
 * refusal from the engine — too far, too heavy — or an end that cannot be
 * found is no suggestion, never an error on the form.
 */
export function usePriceSuggestion(input: SuggestionInput) {
  const parcel = parcelFor(input);
  const count = itemCount(input);
  const enabled = parcel !== null && canLocate(input.pickup) && canLocate(input.dropoff);
  return useQuery({
    queryKey: [
      "create",
      "price-suggestion",
      parcel,
      count,
      place(input.pickup),
      place(input.dropoff),
    ],
    enabled,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      try {
        const [origin, destination] = await Promise.all([
          pointOf(input.pickup),
          pointOf(input.dropoff),
        ]);
        if (!origin || !destination) return null;
        const result = await api.post<{ breakdown: { total: number } }>(
          "/api/pricing/calculate",
          { origin, destination, package: parcel, speed: "STANDARD" }
        );
        return suggestedRange(result.breakdown.total * count);
      } catch {
        return null;
      }
    },
  });
}
