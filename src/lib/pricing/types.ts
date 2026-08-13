/**
 * ============================================================================
 * EXPEDITOO PRICING ENGINE - TYPE DEFINITIONS
 * ============================================================================
 *
 * This file contains all TypeScript interfaces for the pricing system.
 * Modify these types if you need to add new pricing dimensions.
 */

// ---------------------------------------------------------------------------
// ENUMS
// ---------------------------------------------------------------------------

/**
 * Delivery speed options
 * - STANDARD: 3-5 business days (default)
 * - EXPRESS: Next-day delivery
 * - SAME_DAY: Same-day delivery
 * - SCHEDULED: Customer picks specific date/time
 */
export type DeliverySpeed = "STANDARD" | "EXPRESS" | "SAME_DAY" | "SCHEDULED";

/**
 * Distance tiers for pricing
 */
export type DistanceTier = "urban" | "suburban" | "regional" | "long_distance";

/**
 * Weight tiers for pricing
 */
export type WeightTier = "light" | "medium" | "heavy" | "very_heavy";

// ---------------------------------------------------------------------------
// INPUT TYPES
// ---------------------------------------------------------------------------

/**
 * Geographic coordinates
 */
export interface Coordinates {
    lat: number;
    lng: number;
}

/**
 * Package dimensions and weight
 * - length, width, height: in centimeters (cm)
 * - weight: in kilograms (kg)
 */
export interface PackageDimensions {
    length: number; // cm
    width: number; // cm
    height: number; // cm
    weight: number; // kg
}

/**
 * Input for price calculation
 */
export interface PricingInput {
    origin: Coordinates;
    destination: Coordinates;
    package: PackageDimensions;
    speed: DeliverySpeed;
}

// ---------------------------------------------------------------------------
// OUTPUT TYPES
// ---------------------------------------------------------------------------

/**
 * Detailed price breakdown
 * All values are in EUR
 */
export interface PriceBreakdown {
    baseRate: number;
    distanceCost: number;
    weightCost: number;
    volumeCost: number;
    speedSurcharge: number;
    subtotal: number;
    serviceFee: number;
    total: number;
}

/**
 * Distance calculation result
 */
export interface DistanceResult {
    km: number;
    tier: DistanceTier;
}

/**
 * Weight calculation result
 */
export interface WeightResult {
    actual: number; // Actual weight in kg
    volumetric: number; // Volumetric weight (L×W×H / 5000)
    billable: number; // MAX(actual, volumetric)
    tier: WeightTier;
}

/**
 * Volume calculation result
 */
export interface VolumeResult {
    m3: number; // Volume in cubic meters
    liters: number; // Volume in liters
}

/**
 * Estimated delivery information
 */
export interface DeliveryEstimate {
    text: string; // e.g., "3-5 business days"
    minDays: number;
    maxDays: number;
}

/**
 * Complete pricing result
 */
export interface PricingResult {
    breakdown: PriceBreakdown;
    distance: DistanceResult;
    weight: WeightResult;
    volume: VolumeResult;
    speed: DeliverySpeed;
    estimatedDelivery: DeliveryEstimate;
    currency: "EUR";
}

// ---------------------------------------------------------------------------
// CONFIG TYPES
// ---------------------------------------------------------------------------

/**
 * Distance pricing tier configuration
 */
export interface DistancePricingTier {
    maxKm: number;
    ratePerKm: number;
    tier: DistanceTier;
}

/**
 * Weight pricing tier configuration
 */
export interface WeightPricingTier {
    maxKg: number;
    ratePerKg: number;
    tier: WeightTier;
}

/**
 * Speed surcharge configuration
 */
export interface SpeedSurchargeConfig {
    speed: DeliverySpeed;
    surcharge: number;
    estimateText: string;
    minDays: number;
    maxDays: number;
}

/**
 * Complete pricing configuration
 */
export interface PricingConfig {
    // Base rates
    baseRate: number;
    serviceFeePercent: number;
    minPrice: number;

    // Limits
    maxWeight: number;
    maxDistance: number;
    minDistanceThreshold: number;

    // Tier configurations
    distanceTiers: DistancePricingTier[];
    weightTiers: WeightPricingTier[];
    speedSurcharges: SpeedSurchargeConfig[];

    // Volume
    volumeRatePerM3: number;
    volumetricDivisor: number;

    // Currency
    currency: "EUR";
}
