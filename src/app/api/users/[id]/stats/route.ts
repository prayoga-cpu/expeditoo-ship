import { NextResponse } from "next/server";
import { reviewsService } from "@/server/services/reviews.service";

/**
 * GET /api/users/[id]/stats
 * Get rating statistics for a user (public endpoint)
 * Returns average rating, total reviews, and rating distribution
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const stats = await reviewsService.getUserStats(id);

    return NextResponse.json({ success: true, data: stats });
  } catch (error) {
    console.error("Get user stats error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" },
      },
      { status: 500 }
    );
  }
}
