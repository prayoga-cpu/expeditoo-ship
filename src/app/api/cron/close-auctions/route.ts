import { NextResponse } from "next/server";
import { auctionsService } from "@/server/services/auctions.service";

/**
 * Cron endpoint to close expired auctions
 * Called by cron-job.org every minute
 *
 * Protected by CRON_SECRET environment variable
 * Setup at: https://cron-job.org
 */
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // Allow if no secret is set (development) or if secret matches
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Unauthorized" },
      },
      { status: 401 }
    );
  }

  try {
    const result = await auctionsService.processExpiredAuctions();

    return NextResponse.json({
      success: true,
      data: {
        processed: result.processed,
        closed: result.closed,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Cron close-auctions error:", error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Failed to process auctions",
        },
      },
      { status: 500 }
    );
  }
}
