/**
 * ============================================================================
 * PRICING SERVICE - Business Logic for Shipping Cost Calculation
 * ============================================================================
 *
 * This service handles all pricing calculations for the EXPEDITOO platform.
 *
 * Key features:
 * - Distance-based pricing with tiered rates
 * - Weight-based pricing (actual vs volumetric)
 * - Speed surcharges (standard, express, same-day)
 * - Configurable rates via config.ts
 */

import {
    PRICING_CONFIG,
    getDistanceRate,
    getWeightRate,
    getSpeedConfig,
} from "@/lib/pricing/config";
import type {
    PricingInput,
    PricingResult,
    DeliverySpeed,
    DistanceTier,
    WeightTier,
} from "@/lib/pricing/types";

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
}

/**
 * Calculate distance between two coordinates using Haversine formula
 *
 * @param lat1 - Origin latitude
 * @param lng1 - Origin longitude
 * @param lat2 - Destination latitude
 * @param lng2 - Destination longitude
 * @returns Distance in kilometers
 */
function calculateHaversineDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
): number {
    const R = 6371; // Earth's radius in kilometers

    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

/**
 * Calculate volumetric weight from dimensions
 *
 * Formula: (L × W × H in cm) / 5000 = volumetric weight in kg
 */
function calculateVolumetricWeight(
    length: number,
    width: number,
    height: number
): number {
    return (length * width * height) / PRICING_CONFIG.volumetricDivisor;
}

/**
 * Calculate volume in cubic meters
 */
function calculateVolumeM3(
    length: number,
    width: number,
    height: number
): number {
    // Convert cm to meters and multiply
    return (length / 100) * (width / 100) * (height / 100);
}

/**
 * Round to 2 decimal places
 */
function round2(value: number): number {
    return Math.round(value * 100) / 100;
}

// ============================================================================
// PRICING SERVICE
// ============================================================================

export const pricingService = {
    /**
     * Calculate shipping price based on origin, destination, package, and speed
     */
    calculatePrice(input: PricingInput): PricingResult {
        const { origin, destination, package: pkg, speed } = input;

        // 1. Calculate distance
        const distanceKm = calculateHaversineDistance(
            origin.lat,
            origin.lng,
            destination.lat,
            destination.lng
        );

        // 2. Validate distance
        if (distanceKm < PRICING_CONFIG.minDistanceThreshold) {
            throw new Error(
                "Origin and destination must be different locations (minimum 0.5 km apart)"
            );
        }

        if (distanceKm > PRICING_CONFIG.maxDistance) {
            throw new Error(
                `Distance exceeds service area (maximum ${PRICING_CONFIG.maxDistance} km). Please use a freight service.`
            );
        }

        // 3. Calculate weights
        const actualWeight = pkg.weight;
        const volumetricWeight = calculateVolumetricWeight(
            pkg.length,
            pkg.width,
            pkg.height
        );
        const billableWeight = Math.max(actualWeight, volumetricWeight);

        // 4. Validate weight
        if (billableWeight > PRICING_CONFIG.maxWeight) {
            throw new Error(
                `Weight exceeds maximum limit (${PRICING_CONFIG.maxWeight} kg). Please contact support.`
            );
        }

        // 5. Calculate volume
        const volumeM3 = calculateVolumeM3(pkg.length, pkg.width, pkg.height);
        const volumeLiters = volumeM3 * 1000;

        // 6. Get tier rates
        const distanceInfo = getDistanceRate(distanceKm);
        const weightInfo = getWeightRate(billableWeight);
        const speedConfig = getSpeedConfig(speed);

        if (!speedConfig) {
            throw new Error(`Invalid delivery speed: ${speed}`);
        }

        // 7. Calculate costs
        const baseRate = PRICING_CONFIG.baseRate;
        const distanceCost = distanceKm * distanceInfo.rate;
        const weightCost = billableWeight * weightInfo.rate;
        const volumeCost = volumeM3 * PRICING_CONFIG.volumeRatePerM3;
        const speedSurcharge = speedConfig.surcharge;

        // 8. Calculate subtotal (before service fee)
        const subtotal = baseRate + distanceCost + weightCost + volumeCost + speedSurcharge;

        // 9. Calculate service fee
        const serviceFee = subtotal * (PRICING_CONFIG.serviceFeePercent / 100);

        // 10. Calculate total (with minimum price enforcement)
        const rawTotal = subtotal + serviceFee;
        const total = Math.max(rawTotal, PRICING_CONFIG.minPrice);

        // 11. Build result (Convert Cents to EUR)
        const result: PricingResult = {
            breakdown: {
                baseRate: round2(baseRate / 100),
                distanceCost: round2(distanceCost / 100),
                weightCost: round2(weightCost / 100),
                volumeCost: round2(volumeCost / 100),
                speedSurcharge: round2(speedSurcharge / 100),
                subtotal: round2(subtotal / 100),
                serviceFee: round2(serviceFee / 100),
                total: round2(total / 100),
            },
            distance: {
                km: round2(distanceKm),
                tier: distanceInfo.tier as DistanceTier,
            },
            weight: {
                actual: round2(actualWeight),
                volumetric: round2(volumetricWeight),
                billable: round2(billableWeight),
                tier: weightInfo.tier as WeightTier,
            },
            volume: {
                m3: round2(volumeM3),
                liters: round2(volumeLiters),
            },
            speed: speed,
            estimatedDelivery: {
                text: speedConfig.estimateText,
                minDays: speedConfig.minDays,
                maxDays: speedConfig.maxDays,
            },
            currency: "EUR",
        };

        return result;
    },

    /**
     * Quick estimate based on direct values (no coordinates)
     * Useful for UI previews and rough estimates
     */
    quickEstimate(
        distanceKm: number,
        weightKg: number,
        volumeM3: number = 0,
        speed: DeliverySpeed = "STANDARD"
    ): { total: number; breakdown: PricingResult["breakdown"] } {
        // Get tier rates
        const distanceInfo = getDistanceRate(distanceKm);
        const weightInfo = getWeightRate(weightKg);
        const speedConfig = getSpeedConfig(speed);

        if (!speedConfig) {
            throw new Error(`Invalid delivery speed: ${speed}`);
        }

        // Calculate costs
        const baseRate = PRICING_CONFIG.baseRate;
        const distanceCost = distanceKm * distanceInfo.rate;
        const weightCost = weightKg * weightInfo.rate;
        const volumeCostCalc = volumeM3 * PRICING_CONFIG.volumeRatePerM3;
        const speedSurcharge = speedConfig.surcharge;

        const subtotal = baseRate + distanceCost + weightCost + volumeCostCalc + speedSurcharge;
        const serviceFee = subtotal * (PRICING_CONFIG.serviceFeePercent / 100);
        const rawTotal = subtotal + serviceFee;
        const total = Math.max(rawTotal, PRICING_CONFIG.minPrice);

        return {
            total: round2(total / 100),
            breakdown: {
                baseRate: round2(baseRate / 100),
                distanceCost: round2(distanceCost / 100),
                weightCost: round2(weightCost / 100),
                volumeCost: round2(volumeCostCalc / 100),
                speedSurcharge: round2(speedSurcharge / 100),
                subtotal: round2(subtotal / 100),
                serviceFee: round2(serviceFee / 100),
                total: round2(total / 100),
            },
        };
    },

    /**
     * Get all available delivery speeds with their surcharges
     */
    getDeliverySpeeds() {
        return PRICING_CONFIG.speedSurcharges.map((s) => ({
            speed: s.speed,
            surcharge: s.surcharge,
            estimateText: s.estimateText,
            minDays: s.minDays,
            maxDays: s.maxDays,
        }));
    },

    /**
     * Get current pricing configuration (for admin/debugging)
     */
    getConfiguration() {
        return {
            baseRate: PRICING_CONFIG.baseRate,
            serviceFeePercent: PRICING_CONFIG.serviceFeePercent,
            minPrice: PRICING_CONFIG.minPrice,
            maxWeight: PRICING_CONFIG.maxWeight,
            maxDistance: PRICING_CONFIG.maxDistance,
            currency: PRICING_CONFIG.currency,
        };
    },
};
