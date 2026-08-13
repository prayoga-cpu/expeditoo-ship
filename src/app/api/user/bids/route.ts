import { NextResponse } from "next/server";
import { bidsService } from "@/server/services/bids.service";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

// GET /api/user/bids - Get current user's bids
export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    const bids = await bidsService.getMyBids(session.user.id);

    return NextResponse.json({
      success: true,
      data: bids,
    });
  } catch (error) {
    console.error("Get my bids error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch bids",
        },
      },
      { status: 500 }
    );
  }
}
