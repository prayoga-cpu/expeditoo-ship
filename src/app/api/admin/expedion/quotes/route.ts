import type { NextRequest } from "next/server";
import { ok, unauthorised, handleError } from "@/lib/api-response";
import {
  listQuotePage,
  quotePageQuerySchema,
} from "@/server/services/expedion-report.service";
import { resolveViewer } from "@/server/services/viewer.service";

/**
 * GET /api/admin/expedion/quotes?from&to&order&page&limit — every quote in a
 * requested-at window, a page at a time, for Supervision's « Récents » tab
 * (client_feedback_2026_10_29_spec.md §A2). `from` / `to` are instants: the
 * browser turns the days it shows into its own midnights.
 */
export async function GET(request: NextRequest) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();

    const query = quotePageQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    );
    return ok(await listQuotePage(viewer, query));
  } catch (error) {
    return handleError(error, "Admin list Expedion quotes");
  }
}
