import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { reviewsService } from "@/server/services/reviews.service";

/**
 * GET /api/reviews/can-review?listingId=xxx
 * Check if current user can review a listing
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
    const listingId = searchParams.get("listingId");

    if (!listingId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "BAD_REQUEST", message: "listingId is required" },
        },
        { status: 400 }
      );
    }

    const result = await reviewsService.canReview(session.user.id, listingId);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Check can review error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" },
      },
      { status: 500 }
    );
  }
}
