import { NextResponse } from "next/server";
import { bidsService } from "@/server/services/bids.service";

// GET /api/auctions/:listingId/bids - Get bids for listing
export async function GET(
  req: Request,
  { params }: { params: Promise<{ listingId: string }> }
) {
  try {
    const { listingId } = await params;
    // We reuse bidsService because the business logic is the same
    const bids = await bidsService.getBidHistory(listingId);

    return NextResponse.json({
      success: true,
      data: bids,
    });
  } catch (error) {
    console.error("Get bids error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch bid history",
        },
      },
      { status: 500 }
    );
  }
}
