/**
 * AI Price Recommendation API Route
 * POST /api/ai/recommend-price
 * 
 * Analyzes item data (form + slip + photos) and returns price recommendations
 */

import { NextRequest, NextResponse } from "next/server";
import { AIService } from "@/server/services/ai.service";
import {
    AIPriceRecommendationInputDTO,
    type AIResponse,
    type AIPriceRecommendationOutput,
} from "@/server/dto/ai.dto";

export async function POST(
    req: NextRequest
): Promise<NextResponse<AIResponse<AIPriceRecommendationOutput>>> {
    try {
        const body = await req.json();

        // Validate input
        const parseResult = AIPriceRecommendationInputDTO.safeParse(body);
        if (!parseResult.success) {
            console.error("AI Recommendation validation error:", JSON.stringify(parseResult.error.errors, null, 2));
            console.error("Received body:", JSON.stringify(body, null, 2));
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: "VALIDATION_ERROR",
                        message: parseResult.error.errors[0]?.message || "Invalid input",
                    },
                },
                { status: 400 }
            );
        }

        const input = parseResult.data;

        // Call AI service with timeout
        const timeoutPromise = new Promise<null>((resolve) =>
            setTimeout(() => resolve(null), 10000)
        );

        const resultPromise = AIService.recommendPrice(input);

        const result = await Promise.race([resultPromise, timeoutPromise]);

        if (result === null) {
            // Timeout - but AIService should have fallback
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: "TIMEOUT",
                        message: "AI processing timed out. Please try again.",
                    },
                },
                { status: 504 }
            );
        }

        return NextResponse.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error("Error in recommend-price API:", error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: "Failed to generate price recommendation",
                },
            },
            { status: 500 }
        );
    }
}
