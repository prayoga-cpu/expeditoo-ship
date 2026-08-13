import { NextResponse } from "next/server";
import { listingsService } from "@/server/services/listings.service";
import { repostListingSchema } from "@/server/dto/listings.dto";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

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

    // Validate input
    const parsed = repostListingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: parsed.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const result = await listingsService.repostListing(
      id,
      session.user.id,
      parsed.data.auctionDuration
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Repost listing error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("Not authorized")
      ? 403
      : message.includes("not found")
        ? 404
        : 500;

    return NextResponse.json(
      {
        success: false,
        error: {
          code:
            status === 403
              ? "FORBIDDEN"
              : status === 404
                ? "NOT_FOUND"
                : "INTERNAL_SERVER_ERROR",
          message,
        },
      },
      { status }
    );
  }
}
