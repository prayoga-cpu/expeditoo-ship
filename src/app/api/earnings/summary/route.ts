import { auth } from "@/lib/auth";
import { earningsService } from "@/server/services/earnings.service";
import { NextResponse } from "next/server";

/**
 * GET /api/earnings/summary
 * Get earnings summary (totals by source) for the authenticated user
 */
export async function GET(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const summary = await earningsService.getEarningsSummary(session.user.id);

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Error fetching earnings summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch earnings summary" },
      { status: 500 }
    );
  }
}
