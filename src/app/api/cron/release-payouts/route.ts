import { NextRequest, NextResponse } from "next/server";
import { cronHealthService } from "@/server/services/cron-health.service";
import { payoutReleaseService } from "@/server/services/payout-release.service";
import { isAuthorisedCron } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/cron/release-payouts — sends the drivers' share of delivered,
 * undisputed jobs 48 h after delivery, through Stripe Connect
 * (client_feedback_2026_10_29_spec.md §N3). Releases nothing for a driver with
 * no active Connect account; their payout stays in the withdrawal balance.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorisedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await payoutReleaseService.releaseDue();
    await cronHealthService.record("release-payouts", true);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    await cronHealthService.record("release-payouts", false, error);
    console.error("Release payouts job failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
