import { NextResponse } from "next/server";
import { bidsService } from "@/server/services/bids.service";
import { placeBidInput } from "@/server/dto/bids.dto";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

// POST /api/auctions/:listingId/bid - Place a bid
export async function POST(
  req: Request,
  { params }: { params: Promise<{ listingId: string }> }
) {
  try {
    const { listingId } = await params;

    // Check authentication
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

    // Parse and validate body
    const body = await req.json();
    const validation = placeBidInput.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: validation.error.issues[0]?.message || "Invalid input",
          },
        },
        { status: 400 }
      );
    }

    // Place the bid
    const bid = await bidsService.placeBid(
      session.user.id,
      listingId,
      validation.data
    );

    return NextResponse.json({
      success: true,
      data: bid,
    });
  } catch (error) {
    console.error("Place bid error:", error);

    // Handle known business logic errors
    if (error instanceof Error) {
      const knownErrors = [
        "Listing not found",
        "Auction is not active",
        "This listing is not an auction",
        "You cannot bid on your own listing",
      ];

      if (
        knownErrors.some((msg) => error.message.includes(msg)) ||
        error.message.includes("Bid must be at least")
      ) {
        return NextResponse.json(
          {
            success: false,
            error: { code: "BAD_REQUEST", message: error.message },
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to place bid",
        },
      },
      { status: 500 }
    );
  }
}
