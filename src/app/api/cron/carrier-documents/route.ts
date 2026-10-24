import { NextRequest, NextResponse } from "next/server";
import { cronHealthService } from "@/server/services/cron-health.service";
import { carrierService } from "@/server/services/carrier.service";
import { isAuthorisedCron } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/cron/carrier-documents
 *
 * Warns carriers 30 days before a document expires and suspends them once a
 * required one lapses (docs/specs/carrier_kyc_spec.md §7). Suspension stops
 * new bids; shipments already under way finish normally.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorisedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await carrierService.processDocumentExpiry();
    await cronHealthService.record("carrier-documents", true);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    await cronHealthService.record("carrier-documents", false, error);
    console.error("Carrier document expiry job failed:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
