import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getExpedionReport } from "@/server/services/expedion-report.service";
import { hasRole } from "@/server/services/user.service";

/**
 * GET /api/admin/expedion/report — the whole-platform operator report.
 *
 * Session + `admin` role, the same guard `/api/admin/stats` uses. Note this is
 * an `/api/admin/*` route rather than `/api/expedion/*`: the Expedion routes
 * authorise a *client* (and now scope every list to its caller), whereas this
 * one is unscoped by design and must never be reachable by one.
 */
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        },
        { status: 401 }
      );
    }

    const isAdmin = await hasRole(session.user.id, "admin");
    if (!isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "Admin access required" },
        },
        { status: 403 }
      );
    }

    const report = await getExpedionReport();

    return NextResponse.json({ success: true, data: report });
  } catch (error: unknown) {
    console.error("Error fetching Expedion report:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Internal server error",
        },
      },
      { status: 500 }
    );
  }
}
