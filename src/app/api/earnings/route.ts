import { auth } from "@/lib/auth";
import { earningsService } from "@/server/services/earnings.service";
import { NextResponse } from "next/server";
import type { EarningSourceType } from "@/db/schema/earnings";

/**
 * GET /api/earnings
 * Get earnings history for the authenticated user
 */
export async function GET(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const source = url.searchParams.get("source") as EarningSourceType | null;

    const result = await earningsService.getEarningsHistory(session.user.id, {
      limit,
      offset,
      source: source || undefined,
    });

    return NextResponse.json({
      success: true,
      data: result.items,
      pagination: {
        total: result.total,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error("Error fetching earnings:", error);
    return NextResponse.json(
      { error: "Failed to fetch earnings" },
      { status: 500 }
    );
  }
}
