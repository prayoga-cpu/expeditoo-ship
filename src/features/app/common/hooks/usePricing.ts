/**
 * ============================================================================
 * usePricing Hook
 * ============================================================================
 *
 * React hook for calculating shipping prices using TanStack Query.
 *
 * Features:
 * - Automatic caching of calculations
 * - Loading and error states
 * - Mutation for on-demand calculations
 * - Get pricing config (delivery speeds, rates)
 *
 * @example
 * // Get pricing config
 * const { config, isLoadingConfig } = usePricing();
 *
 * // Calculate price on button click
 * const { calculatePrice, calculation, isCalculating } = usePricing();
 * calculatePrice({
 *   origin: { lat: 48.8566, lng: 2.3522 },
 *   destination: { lat: 48.8847, lng: 2.3425 },
 *   package: { length: 30, width: 20, height: 15, weight: 5 },
 *   speed: "STANDARD"
 * });
 */

"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
    pricingApi,
    pricingQueryKeys,
    type CalculatePriceRequest,
} from "../api/pricing.api";
import type { PricingResult, DeliverySpeed } from "@/lib/pricing/types";

// ---------------------------------------------------------------------------
// HOOK OPTIONS
// ---------------------------------------------------------------------------

export interface UsePricingOptions {
    /**
     * Whether to fetch pricing config on mount
     * @default true
     */
    fetchConfigOnMount?: boolean;
}

// ---------------------------------------------------------------------------
// HOOK RETURN TYPE
// ---------------------------------------------------------------------------

export interface UsePricingReturn {
    // Config
    config: {
        baseRate: number;
        serviceFeePercent: number;
        minPrice: number;
        maxWeight: number;
        maxDistance: number;
        currency: "EUR";
    } | null;
    deliverySpeeds: Array<{
        speed: DeliverySpeed;
        surcharge: number;
        estimateText: string;
        minDays: number;
        maxDays: number;
    }>;
    isLoadingConfig: boolean;
    configError: Error | null;

    // Calculate
    calculatePrice: (params: CalculatePriceRequest) => void;
    calculation: PricingResult | null;
    isCalculating: boolean;
    calculateError: Error | null;

    // Reset
    resetCalculation: () => void;
}

// ---------------------------------------------------------------------------
// HOOK IMPLEMENTATION
// ---------------------------------------------------------------------------

export function usePricing(
    options: UsePricingOptions = {}
): UsePricingReturn {
    const { fetchConfigOnMount = true } = options;

    // Local state for calculation result
    const [calculation, setCalculation] = useState<PricingResult | null>(null);

    // Fetch pricing config
    const {
        data: configData,
        isLoading: isLoadingConfig,
        error: configError,
    } = useQuery({
        queryKey: pricingQueryKeys.config(),
        queryFn: async () => {
            const result = await pricingApi.getConfig();
            if (!result.success || !result.data) {
                throw new Error(result.error?.message || "Failed to load pricing config");
            }
            return result.data;
        },
        enabled: fetchConfigOnMount,
        staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    });

    // Calculate price mutation
    const calculateMutation = useMutation({
        mutationFn: async (params: CalculatePriceRequest) => {
            const result = await pricingApi.calculate(params);
            if (!result.success || !result.data) {
                throw new Error(result.error?.message || "Failed to calculate price");
            }
            return result.data;
        },
        onSuccess: (data) => {
            setCalculation(data);
        },
        onError: () => {
            setCalculation(null);
        },
    });

    // Reset calculation
    const resetCalculation = () => {
        setCalculation(null);
        calculateMutation.reset();
    };

    return {
        // Config
        config: configData?.config || null,
        deliverySpeeds: configData?.deliverySpeeds || [],
        isLoadingConfig,
        configError: configError as Error | null,

        // Calculate
        calculatePrice: calculateMutation.mutate,
        calculation,
        isCalculating: calculateMutation.isPending,
        calculateError: calculateMutation.error as Error | null,

        // Reset
        resetCalculation,
    };
}

// ---------------------------------------------------------------------------
// SIMPLIFIED HOOKS
// ---------------------------------------------------------------------------

/**
 * Hook to only get pricing config (delivery speeds, rates)
 *
 * @example
 * const { deliverySpeeds, isLoading } = usePricingConfig();
 */
export function usePricingConfig() {
    const { config, deliverySpeeds, isLoadingConfig, configError } = usePricing({
        fetchConfigOnMount: true,
    });

    return {
        config,
        deliverySpeeds,
        isLoading: isLoadingConfig,
        error: configError,
    };
}

/**
 * Hook to calculate price for a shipment preview
 *
 * @example
 * const { calculate, result, isCalculating } = useCalculatePrice();
 *
 * // Trigger calculation
 * calculate({
 *   origin: sellerLocation,
 *   destination: buyerLocation,
 *   package: packageDimensions,
 *   speed: selectedSpeed
 * });
 */
export function useCalculatePrice() {
    const { calculatePrice, calculation, isCalculating, calculateError, resetCalculation } =
        usePricing({ fetchConfigOnMount: false });

    return {
        calculate: calculatePrice,
        result: calculation,
        isCalculating,
        error: calculateError,
        reset: resetCalculation,
    };
}
