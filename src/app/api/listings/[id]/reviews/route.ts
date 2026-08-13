import { NextResponse } from "next/server";
import { reviewsService } from "@/server/services/reviews.service";

/**
 * GET /api/listings/[id]/reviews
 * Get all reviews related to a specific listing
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const reviews = await reviewsService.getListingReviews(id);

    return NextResponse.json({ success: true, data: reviews });
  } catch (error) {
    console.error("Get listing reviews error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" },
      },
      { status: 500 }
    );
  }
}
