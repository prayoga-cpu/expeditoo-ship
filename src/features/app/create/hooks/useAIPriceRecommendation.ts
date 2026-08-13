/**
 * AI Price Recommendation Hook
 * Manages state for fetching and applying AI price recommendations
 */

import { useState, useCallback } from "react";
import { fetchPriceRecommendation } from "../api/price-recommendation.api";
import type {
    AIPriceRecommendationInput,
    AIPriceRecommendationOutput,
    ProcessSlipOutput
} from "@/server/dto/ai.dto";

interface UseAIPriceRecommendationOptions {
    onApplyStartingBid?: (price: number) => void;
    onApplyBuyNowPrice?: (price: number) => void;
}

interface UseAIPriceRecommendationReturn {
    recommendation: AIPriceRecommendationOutput | null;
    isLoading: boolean;
    error: string | null;
    hasAttempted: boolean;
    appliedFields: {
        startingBid: boolean;
        buyNowPrice: boolean;
    };
    fetchRecommendation: (
        formData: {
            title: string;
            category: string;
            condition: "new" | "used_like_new" | "used_good" | "used_fair";
            weight: string;
            dimensions: { length: number; width: number; height: number };
            quantity: number;
            description?: string;
        },
        location: { city: string; country: string },
        photos: string[],
        slipData?: ProcessSlipOutput | null
    ) => Promise<void>;
    applyStartingBid: () => void;
    applyBuyNowPrice: () => void;
    refresh: () => void;
    reset: () => void;
}

export function useAIPriceRecommendation(
    options: UseAIPriceRecommendationOptions = {}
): UseAIPriceRecommendationReturn {
    const { onApplyStartingBid, onApplyBuyNowPrice } = options;

    const [recommendation, setRecommendation] = useState<AIPriceRecommendationOutput | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasAttempted, setHasAttempted] = useState(false);
    const [appliedFields, setAppliedFields] = useState({
        startingBid: false,
        buyNowPrice: false,
    });
    const [lastInput, setLastInput] = useState<AIPriceRecommendationInput | null>(null);

    const fetchRecommendation = useCallback(
        async (
            formData: {
                title: string;
                category: string;
                condition: "new" | "used_like_new" | "used_good" | "used_fair";
                weight: string;
                dimensions: { length: number; width: number; height: number };
                quantity: number;
                description?: string;
            },
            location: { city: string; country: string },
            photos: string[],
            slipData?: ProcessSlipOutput | null
        ) => {
            setIsLoading(true);
            setError(null);
            setHasAttempted(true);
            setAppliedFields({ startingBid: false, buyNowPrice: false });

            const input: AIPriceRecommendationInput = {
                form: formData,
                location,
                photos,
            };

            // Add slip data if available
            if (slipData) {
                input.slip = {
                    originalPrice: slipData.price,
                    extractedDimensions: slipData.dimensions,
                    extractedWeight: slipData.weight,
                    extractedDescription: slipData.description,
                };
            }

            setLastInput(input);

            try {
                const result = await fetchPriceRecommendation(input);
                setRecommendation(result);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to get recommendation");
                setRecommendation(null);
            } finally {
                setIsLoading(false);
            }
        },
        []
    );

    const applyStartingBid = useCallback(() => {
        if (recommendation && onApplyStartingBid) {
            onApplyStartingBid(recommendation.recommendedStartingBid);
            setAppliedFields((prev) => ({ ...prev, startingBid: true }));
        }
    }, [recommendation, onApplyStartingBid]);

    const applyBuyNowPrice = useCallback(() => {
        if (recommendation && onApplyBuyNowPrice) {
            onApplyBuyNowPrice(recommendation.recommendedBuyNowPrice);
            setAppliedFields((prev) => ({ ...prev, buyNowPrice: true }));
        }
    }, [recommendation, onApplyBuyNowPrice]);

    const refresh = useCallback(async () => {
        if (lastInput) {
            setIsLoading(true);
            setError(null);
            setAppliedFields({ startingBid: false, buyNowPrice: false });

            try {
                const result = await fetchPriceRecommendation(lastInput);
                setRecommendation(result);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to get recommendation");
            } finally {
                setIsLoading(false);
            }
        }
    }, [lastInput]);

    const reset = useCallback(() => {
        setRecommendation(null);
        setIsLoading(false);
        setError(null);
        setHasAttempted(false);
        setAppliedFields({ startingBid: false, buyNowPrice: false });
        setLastInput(null);
    }, []);

    return {
        recommendation,
        isLoading,
        error,
        hasAttempted,
        appliedFields,
        fetchRecommendation,
        applyStartingBid,
        applyBuyNowPrice,
        refresh,
        reset,
    };
}
