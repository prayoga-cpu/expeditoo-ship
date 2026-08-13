/**
 * Price Recommendation API Client
 * Calls /api/ai/recommend-price endpoint
 */

import type {
    AIPriceRecommendationInput,
    AIPriceRecommendationOutput,
    AIResponse
} from "@/server/dto/ai.dto";

export async function fetchPriceRecommendation(
    input: AIPriceRecommendationInput
): Promise<AIPriceRecommendationOutput> {
    const res = await fetch("/api/ai/recommend-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });

    const data: AIResponse<AIPriceRecommendationOutput> = await res.json();

    if (!data.success) {
        throw new Error(data.error?.message || "Failed to get price recommendation");
    }

    return data.data;
}
