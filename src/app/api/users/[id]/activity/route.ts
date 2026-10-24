import { listingsService } from "@/server/services/listings.service";
import { resolveViewer } from "@/server/services/viewer.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

/**
 * GET /api/users/:id/activity — « demandes publiées » and « prises en charge »
 * for one person, to themselves or to staff (client_feedback_2026_10_21_spec.md §D6).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();

    const { id } = await params;
    return ok(await listingsService.activityFor(viewer, id));
  } catch (error) {
    return handleError(error, "User activity");
  }
}
