import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { PlaceBidSchema } from "@/server/dto/auctions.dto";
import { auctionsService } from "@/server/services/auctions.service";

export async function POST(
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
    const body = await req.json();
    const validation = PlaceBidSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: validation.error.format(),
          },
        },
        { status: 400 }
      );
    }

    const bid = await auctionsService.placeBid(
      id,
      session.user.id,
      validation.data
    );

    return NextResponse.json({ success: true, data: bid }, { status: 201 });
  } catch (error) {
    console.error("Place bid error:", error);
    
    // Determine status code based on error message (simple heuristic)
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = 
      message.includes("not found") ? 404 :
      message.includes("not an auction") ? 400 :
      message.includes("not active") ? 400 :
      message.includes("own listing") ? 400 :
      message.includes("ended") ? 400 :
      message.includes("Bid must be") ? 400 :
      500;

    return NextResponse.json(
      {
        success: false,
        error: {
          code: status === 500 ? "INTERNAL_SERVER_ERROR" : "BAD_REQUEST",
          message: message,
        },
      },
      { status }
    );
  }
}
