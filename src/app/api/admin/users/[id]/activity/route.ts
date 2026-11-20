import { resolveViewer } from "@/server/services/viewer.service";
import { adminUserActivityService } from "@/server/services/admin-user-activity.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/users/:id/activity — who the account is and how many
 * requests, offers and conversations it has (admin_user_management_spec.md
 * §7). Read-only; the service refuses anyone but admin and support.
 */
export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();

    const { id } = await params;
    return ok(await adminUserActivityService.summary(viewer.userId, id));
  } catch (error) {
    return handleError(error, "Admin user activity summary");
  }
}
