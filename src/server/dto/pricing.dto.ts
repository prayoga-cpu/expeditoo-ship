/**
 * ============================================================================
 * PRICING DTO - Input/Output Validation Schemas
 * ============================================================================
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// COMMON SCHEMAS
// ---------------------------------------------------------------------------

/**
 * Geographic coordinates validation
 */
export const coordinatesSchema = z.object({
    lat: z
        .number()
        .min(-90, "Latitude must be between -90 and 90")
        .max(90, "Latitude must be between -90 and 90"),
    lng: z
        .number()
        .min(-180, "Longitude must be between -180 and 180")
        .max(180, "Longitude must be between -180 and 180"),
});

/**
 * Package dimensions validation
 */
export const packageDimensionsSchema = z.object({
    length: z
        .number()
        .positive("Length must be a positive number")
        .max(300, "Length cannot exceed 300 cm"),
    width: z
        .number()
        .positive("Width must be a positive number")
        .max(300, "Width cannot exceed 300 cm"),
    height: z
        .number()
        .positive("Height must be a positive number")
        .max(300, "Height cannot exceed 300 cm"),
    weight: z
        .number()
        .positive("Weight must be a positive number")
        .max(100, "Weight cannot exceed 100 kg"),
});

/**
 * Delivery speed enum
 */
export const deliverySpeedSchema = z.enum([
    "STANDARD",
    "EXPRESS",
    "SAME_DAY",
    "SCHEDULED",
]);

// ---------------------------------------------------------------------------
// INPUT SCHEMAS
// ---------------------------------------------------------------------------

/**
 * Calculate price request body
 */
export const calculatePriceInputSchema = z.object({
    origin: coordinatesSchema,
    destination: coordinatesSchema,
    package: packageDimensionsSchema,
    speed: deliverySpeedSchema.default("STANDARD"),
});

export type CalculatePriceInput = z.infer<typeof calculatePriceInputSchema>;

// ---------------------------------------------------------------------------
// OUTPUT SCHEMAS
// ---------------------------------------------------------------------------

/**
 * Price breakdown in response
 */
export const priceBreakdownSchema = z.object({
    baseRate: z.number(),
    distanceCost: z.number(),
    weightCost: z.number(),
    volumeCost: z.number(),
    speedSurcharge: z.number(),
    subtotal: z.number(),
    serviceFee: z.number(),
    total: z.number(),
});

/**
 * Distance result in response
 */
export const distanceResultSchema = z.object({
    km: z.number(),
    tier: z.enum(["urban", "suburban", "regional", "long_distance"]),
});

/**
 * Weight result in response
 */
export const weightResultSchema = z.object({
    actual: z.number(),
    volumetric: z.number(),
    billable: z.number(),
    tier: z.enum(["light", "medium", "heavy", "very_heavy"]),
});

/**
 * Volume result in response
 */
export const volumeResultSchema = z.object({
    m3: z.number(),
    liters: z.number(),
});

/**
 * Delivery estimate in response
 */
export const deliveryEstimateSchema = z.object({
    text: z.string(),
    minDays: z.number(),
    maxDays: z.number(),
});

/**
 * Complete pricing result
 */
export const pricingResultSchema = z.object({
    breakdown: priceBreakdownSchema,
    distance: distanceResultSchema,
    weight: weightResultSchema,
    volume: volumeResultSchema,
    speed: deliverySpeedSchema,
    estimatedDelivery: deliveryEstimateSchema,
    currency: z.literal("EUR"),
});

export type PricingResultDTO = z.infer<typeof pricingResultSchema>;

// ---------------------------------------------------------------------------
// SIMPLIFIED SCHEMAS (for quick estimates)
// ---------------------------------------------------------------------------

/**
 * Quick estimate input (just distance and package size)
 */
export const quickEstimateInputSchema = z.object({
    distanceKm: z.number().positive().max(1000),
    weightKg: z.number().positive().max(100),
    volumeM3: z.number().positive().max(10).optional(),
    speed: deliverySpeedSchema.default("STANDARD"),
});

export type QuickEstimateInput = z.infer<typeof quickEstimateInputSchema>;
