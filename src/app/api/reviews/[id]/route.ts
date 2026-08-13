import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { reviewsService } from "@/server/services/reviews.service";

/**
 * GET /api/reviews/[id]
 * Get a single review by ID
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const review = await reviewsService.getReviewById(id);

    if (!review) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Review not found" },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: review });
  } catch (error) {
    console.error("Get review error:", error);
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
 * DELETE /api/reviews/[id]
 * Delete own review
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const deleted = await reviewsService.deleteReview(id, session.user.id);

    return NextResponse.json({ success: true, data: deleted });
  } catch (error) {
    console.error("Delete review error:", error);

    const message =
      error instanceof Error ? error.message : "Internal server error";

    if (message.startsWith("REVIEW_NOT_FOUND:")) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: message.split(": ")[1] },
        },
        { status: 404 }
      );
    }

    if (message.startsWith("NOT_AUTHORIZED:")) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: message.split(": ")[1] },
        },
        { status: 403 }
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
