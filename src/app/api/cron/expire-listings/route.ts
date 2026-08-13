import { NextRequest, NextResponse } from "next/server";
import { listingsService } from "@/server/services/listings.service";
import { isAuthorisedCron } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/cron/expire-listings
 *
 * Closes jobs whose bidding window passed with no carrier selected, expires
 * their pending offers and tells the shipper
 * (docs/specs/offers_engine_spec.md §7). No payment is touched - nothing was
 * ever authorised on an unawarded job.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorisedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const expired = await listingsService.expireDueListings();
    return NextResponse.json({ success: true, expired });
  } catch (error) {
    console.error("Expire listings job failed:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
