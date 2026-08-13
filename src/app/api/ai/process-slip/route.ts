/**
 * AI Slip Processing API Route
 * POST /api/ai/process-slip
 * 
 * Processes purchase slip/receipt images using OpenAI Vision OCR to extract:
 * - Dimensions (length, width, height)
 * - Weight
 * - Price
 * - Description
 */

import { NextRequest, NextResponse } from "next/server";
import { AIService } from "@/server/services/ai.service";
import {
  ProcessSlipInputDTO,
  type AIResponse,
  type ProcessSlipOutput,
} from "@/server/dto/ai.dto";

export async function POST(
  req: NextRequest
): Promise<NextResponse<AIResponse<ProcessSlipOutput>>> {
  try {
    const body = await req.json();

    // Validate input
    const parseResult = ProcessSlipInputDTO.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Image data is required",
          },
        },
        { status: 400 }
      );
    }

    const { image } = parseResult.data;

    // Call AI service with timeout
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 15000)
    );

    const resultPromise = AIService.processSlip(image);

    const result = await Promise.race([resultPromise, timeoutPromise]);

    if (result === null) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "TIMEOUT",
            message: "Slip processing timed out. Please try again.",
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
    console.error("Error processing slip:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to process purchase slip",
        },
      },
      { status: 500 }
    );
  }
}

