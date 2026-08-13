import { NextResponse } from "next/server";
import { reviewsService } from "@/server/services/reviews.service";
import { reviewsQuerySchema } from "@/server/dto/reviews.dto";

/**
 * GET /api/users/[id]/reviews
 * Get reviews received by a specific user (public endpoint)
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);

    const query = reviewsQuerySchema.parse({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
      type: searchParams.get("type") || undefined,
    });

    const reviews = await reviewsService.getUserReviews(id, query);

    return NextResponse.json({ success: true, data: reviews });
  } catch (error) {
    console.error("Get user reviews error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" },
      },
      { status: 500 }
    );
  }
}
