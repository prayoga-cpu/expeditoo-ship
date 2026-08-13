/**
 * ============================================================================
 * API: Calculate Shipping Price
 * ============================================================================
 *
 * POST /api/pricing/calculate
 *
 * Calculates the shipping cost based on:
 * - Origin and destination coordinates
 * - Package dimensions and weight
 * - Delivery speed
 */

import { NextRequest, NextResponse } from "next/server";
import { calculatePriceInputSchema } from "@/server/dto/pricing.dto";
import { pricingService } from "@/server/services/pricing.service";
import { ZodError } from "zod";

export async function POST(request: NextRequest) {
    try {
        // 1. Parse request body
        const body = await request.json();

        // 2. Validate input with Zod
        const input = calculatePriceInputSchema.parse(body);

        // 3. Calculate price
        const result = pricingService.calculatePrice(input);

        // 4. Return success response
        return NextResponse.json({
            success: true,
            data: result,
        });
    } catch (error) {
        // Handle Zod validation errors
        if (error instanceof ZodError) {
            const details: Record<string, string> = {};
            error.errors.forEach((err) => {
                const path = err.path.join(".");
                details[path] = err.message;
            });

            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: "VALIDATION_ERROR",
                        message: "Invalid input data",
                        details,
                    },
                },
                { status: 400 }
            );
        }

        // Handle business logic errors
        if (error instanceof Error) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: "PRICING_ERROR",
                        message: error.message,
                    },
                },
                { status: 400 }
            );
        }

        // Handle unexpected errors
        console.error("Pricing calculation error:", error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: "An unexpected error occurred",
                },
            },
            { status: 500 }
        );
    }
}

/**
 * GET /api/pricing/calculate
 *
 * Returns pricing configuration and available delivery speeds
 */
export async function GET() {
    try {
        const config = pricingService.getConfiguration();
        const speeds = pricingService.getDeliverySpeeds();

        return NextResponse.json({
            success: true,
            data: {
                config,
                deliverySpeeds: speeds,
            },
        });
    } catch (error) {
        console.error("Get pricing config error:", error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: "Failed to retrieve pricing configuration",
                },
            },
            { status: 500 }
        );
    }
}
