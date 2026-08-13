/**
 * ============================================================================
 * PRICING CLIENT API
 * ============================================================================
 *
 * Client-side API wrapper for pricing calculations.
 * Provides typed fetch functions and TanStack Query integration.
 *
 * Usage:
 * - Direct fetch: await pricingApi.calculate({ ... })
 * - With React Query: usePricing hook
 */

import type { PricingResult, DeliverySpeed } from "@/lib/pricing/types";

// ---------------------------------------------------------------------------
// REQUEST/RESPONSE TYPES
// ---------------------------------------------------------------------------

export interface CalculatePriceRequest {
    origin: {
        lat: number;
        lng: number;
    };
    destination: {
        lat: number;
        lng: number;
    };
    package: {
        length: number; // cm
        width: number; // cm
        height: number; // cm
        weight: number; // kg
    };
    speed?: DeliverySpeed;
}

export interface PricingConfigResponse {
    config: {
        baseRate: number;
        serviceFeePercent: number;
        minPrice: number;
        maxWeight: number;
        maxDistance: number;
        currency: "EUR";
    };
    deliverySpeeds: Array<{
        speed: DeliverySpeed;
        surcharge: number;
        estimateText: string;
        minDays: number;
        maxDays: number;
    }>;
}

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: Record<string, string>;
    };
}

// ---------------------------------------------------------------------------
// API CLIENT
// ---------------------------------------------------------------------------

const API_BASE = "/api/pricing/calculate";

export const pricingApi = {
    /**
     * Calculate shipping price based on origin, destination, package, and speed
     *
     * @example
     * const result = await pricingApi.calculate({
     *   origin: { lat: 48.8566, lng: 2.3522 },
     *   destination: { lat: 48.8847, lng: 2.3425 },
     *   package: { length: 30, width: 20, height: 15, weight: 5 },
     *   speed: "STANDARD"
     * });
     */
    async calculate(
        request: CalculatePriceRequest
    ): Promise<ApiResponse<PricingResult>> {
        const response = await fetch(API_BASE, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                ...request,
                speed: request.speed || "STANDARD",
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            return {
                success: false,
                error: data.error || {
                    code: "UNKNOWN_ERROR",
                    message: "Failed to calculate price",
                },
            };
        }

        return data;
    },

    /**
     * Get pricing configuration and available delivery speeds
     *
     * @example
     * const config = await pricingApi.getConfig();
     * console.log(config.data?.deliverySpeeds);
     */
    async getConfig(): Promise<ApiResponse<PricingConfigResponse>> {
        const response = await fetch(API_BASE, {
            method: "GET",
        });

        const data = await response.json();

        if (!response.ok) {
            return {
                success: false,
                error: data.error || {
                    code: "UNKNOWN_ERROR",
                    message: "Failed to get pricing config",
                },
            };
        }

        return data;
    },
};

// ---------------------------------------------------------------------------
// QUERY KEYS (for TanStack Query)
// ---------------------------------------------------------------------------

export const pricingQueryKeys = {
    all: ["pricing"] as const,
    config: () => [...pricingQueryKeys.all, "config"] as const,
    calculate: (params: CalculatePriceRequest) =>
        [...pricingQueryKeys.all, "calculate", params] as const,
};
