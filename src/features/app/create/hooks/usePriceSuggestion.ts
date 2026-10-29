"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/fetcher";
import {
  suggestedRange,
  suggestionRequest,
  type SuggestionInput,
} from "../price-suggestion";

/**
 * The suggested range for the request as typed so far (§B6), or null. A
 * refusal from the engine — too far, too heavy — is no suggestion, never an
 * error on the form.
 */
export function usePriceSuggestion(input: SuggestionInput) {
  const request = suggestionRequest(input);
  return useQuery({
    queryKey: ["create", "price-suggestion", request],
    enabled: request !== null,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      try {
        const result = await api.post<{ breakdown: { total: number } }>(
          "/api/pricing/calculate",
          request
        );
        return suggestedRange(result.breakdown.total);
      } catch {
        return null;
      }
    },
  });
}
