import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { cronHealthService } from "@/server/services/cron-health.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

/**
 * GET /api/admin/cron-status — the last run of each scheduled job, and whether
 * it is on time (client_feedback_2026_10_21_spec.md §X1). Admin or finance.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    return ok(await cronHealthService.getForAdmin(session.user.id));
  } catch (error) {
    return handleError(error, "Cron status");
  }
}
