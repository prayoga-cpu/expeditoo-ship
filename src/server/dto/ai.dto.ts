/**
 * AI DTOs - Data Transfer Objects for AI endpoints
 * Follows Zod validation pattern from project architecture
 */

import { z } from "zod";

// ============================================
// Price Recommendation DTOs
// ============================================

export const SlipDataSchema = z.object({
    originalPrice: z.number().optional(),
    purchaseDate: z.string().optional(),
    extractedDimensions: z
        .object({
            length: z.number(),
            width: z.number(),
            height: z.number(),
        })
        .optional(),
    extractedWeight: z.string().optional(),
    extractedDescription: z.string().optional(),
});

export const FormDataSchema = z.object({
    title: z.string().default(""),
    category: z.string().default("others"),
    condition: z.enum(["new", "used_like_new", "used_good", "used_fair"]).default("used_good"),
    weight: z.string().default("0-5"),
    dimensions: z.object({
        length: z.coerce.number().default(0),
        width: z.coerce.number().default(0),
        height: z.coerce.number().default(0),
    }).default({ length: 0, width: 0, height: 0 }),
    quantity: z.coerce.number().min(1).default(1),
    description: z.string().optional(),
});

export const LocationSchema = z.object({
    city: z.string().default(""),
    country: z.string().default("France"),
});

export const AIPriceRecommendationInputDTO = z.object({
    slip: SlipDataSchema.optional(),
    form: FormDataSchema,
    location: LocationSchema,
    photos: z.array(z.string()).max(5),
});

export type AIPriceRecommendationInput = z.infer<typeof AIPriceRecommendationInputDTO>;

export const PriceBreakdownSchema = z.object({
    baseValue: z.number(),
    conditionAdjustment: z.number(),
    categoryFactor: z.number(),
    sizeFactor: z.number(),
});

export const AIPriceRecommendationOutputDTO = z.object({
    recommendedStartingBid: z.number().min(1).max(50000),
    recommendedBuyNowPrice: z.number().min(1).max(50000),
    confidence: z.number().min(0).max(1),
    reasoning: z.string(),
    priceBreakdown: PriceBreakdownSchema.optional(),
});

export type AIPriceRecommendationOutput = z.infer<typeof AIPriceRecommendationOutputDTO>;

// ============================================
// Slip Processing DTOs
// ============================================

export const ProcessSlipInputDTO = z.object({
    image: z.string().min(1), // Base64 encoded image
});

export type ProcessSlipInput = z.infer<typeof ProcessSlipInputDTO>;

export const ProcessSlipOutputDTO = z.object({
    dimensions: z
        .object({
            length: z.number(),
            width: z.number(),
            height: z.number(),
        })
        .optional(),
    weight: z.string().optional(),
    price: z.number().optional(),
    description: z.string().optional(),
    confidence: z.number().min(0).max(1).optional(),
});

export type ProcessSlipOutput = z.infer<typeof ProcessSlipOutputDTO>;

// ============================================
// API Response Wrappers
// ============================================

export interface AISuccessResponse<T> {
    success: true;
    data: T;
}

export interface AIErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
    };
}

export type AIResponse<T> = AISuccessResponse<T> | AIErrorResponse;
