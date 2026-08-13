import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { reviewsService } from "@/server/services/reviews.service";
import {
  createReviewSchema,
  reviewsQuerySchema,
} from "@/server/dto/reviews.dto";

/**
 * POST /api/reviews
 * Create a new review
 */
export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Unauthorized" },
        },
        { status: 401 }
      );
    }

    const body = await req.json();
    const validation = createReviewSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request data",
            details: validation.error.format(),
          },
        },
        { status: 400 }
      );
    }

    const review = await reviewsService.createReview(
      session.user.id,
      validation.data
    );

    return NextResponse.json({ success: true, data: review }, { status: 201 });
  } catch (error) {
    console.error("Create review error:", error);

    // Handle business logic errors
    const message =
      error instanceof Error ? error.message : "Internal server error";

    if (message.startsWith("ALREADY_REVIEWED:")) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "ALREADY_REVIEWED", message: message.split(": ")[1] },
        },
        { status: 409 }
      );
    }

    if (message.startsWith("NOT_AUTHORIZED:")) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_AUTHORIZED", message: message.split(": ")[1] },
        },
        { status: 403 }
      );
    }

    if (
      message.startsWith("LISTING_NOT_FOUND:") ||
      message.startsWith("SHIPMENT_NOT_FOUND:") ||
      message.startsWith("INVALID_TARGET:") ||
      message.startsWith("INVALID_CONTEXT:")
    ) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "BAD_REQUEST", message: message.split(": ")[1] },
        },
        { status: 400 }
      );
    }

    if (
      message.startsWith("LISTING_NOT_COMPLETE:") ||
      message.startsWith("SHIPMENT_NOT_COMPLETE:") ||
      message.startsWith("TRANSACTION_NOT_COMPLETE:")
    ) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "PRECONDITION_FAILED", message: message.split(": ")[1] },
        },
        { status: 412 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" },
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/reviews
 * Get reviews written by the current user
 */
export async function GET(req: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Unauthorized" },
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const query = reviewsQuerySchema.parse({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
      type: searchParams.get("type"),
    });

    const reviews = await reviewsService.getAuthoredReviews(
      session.user.id,
      query
    );

    return NextResponse.json({ success: true, data: reviews });
  } catch (error) {
    console.error("Get reviews error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" },
      },
      { status: 500 }
    );
  }
}
