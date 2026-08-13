/**
 * GET /api/cron/expedion-escalate
 *
 * The auto-escalate sweep. Paid jobs that have sat past their configured
 * window with no driver assigned are pushed onto the Expeditoo marketplace.
 *
 * Guarded by CRON_SECRET, matching the other cron routes. Safe to run
 * concurrently: escalation claims each quote with a conditional update, so an
 * overlapping run produces no duplicate listings.
 */

import { NextRequest, NextResponse } from "next/server";
import { expedionEscalationService } from "@/server/services/expedion-escalation.service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const { searchParams } = new URL(req.url);
  const querySecret = searchParams.get("secret");

  const expectedSecret = process.env.CRON_SECRET;
  if (
    !expectedSecret ||
    (authHeader !== `Bearer ${expectedSecret}` && querySecret !== expectedSecret)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const limit = Number(searchParams.get("limit") ?? 50);
    const summary = await expedionEscalationService.runAutoEscalation(
      new Date(),
      Number.isFinite(limit) && limit > 0 ? Math.min(limit, 200) : 50
    );

    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    console.error("[expedion] auto-escalation sweep failed", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
