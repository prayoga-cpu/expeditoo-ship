import { resolveViewer } from "@/server/services/viewer.service";
import { adminUserActivityService } from "@/server/services/admin-user-activity.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/users/:id/conversations — the conversations this account is in
 * (admin_user_management_spec.md §7). Read-only; the service refuses anyone
 * but admin and support.
 */
export async function GET(req: Request, { params }: RouteParams) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();

    const { id } = await params;
    const query = Object.fromEntries(new URL(req.url).searchParams);
    return ok(await adminUserActivityService.conversations(viewer.userId, id, query));
  } catch (error) {
    return handleError(error, "Admin user conversations");
  }
}
