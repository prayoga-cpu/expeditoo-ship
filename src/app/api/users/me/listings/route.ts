import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listingsService } from "@/server/services/listings.service";

/**
 * GET /api/users/me/listings
 * Get listings owned by the current user
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
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

    const listings = await listingsService.getListingsBySeller(session.user.id);

    return NextResponse.json({
      success: true,
      data: listings,
    });
  } catch (error) {
    console.error("[API] GET /api/users/me/listings error:", error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch listings",
        },
      },
      { status: 500 }
    );
  }
}
