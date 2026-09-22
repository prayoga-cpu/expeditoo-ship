import { NextRequest, NextResponse } from "next/server";
import { listingsService } from "@/server/services/listings.service";
import { isAuthorisedCron } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/cron/publish-scheduled-listings
 *
 * Flips a `scheduled` job to `open` once its chosen go-live instant has
 * arrived. The bidding deadline was already anchored on that instant at
 * creation time, so the common case is a plain status flip; a job whose
 * window closed while this run was late is expired instead of opened dead
 * (`listingsService.publishScheduled`).
 */
export async function GET(req: NextRequest) {
  if (!isAuthorisedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const published = await listingsService.publishScheduled();
    return NextResponse.json({ success: true, published });
  } catch (error) {
    console.error("Publish scheduled listings job failed:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
