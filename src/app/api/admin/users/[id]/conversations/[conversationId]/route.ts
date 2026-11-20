import { resolveViewer } from "@/server/services/viewer.service";
import { adminUserActivityService } from "@/server/services/admin-user-activity.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string; conversationId: string }>;
}

/**
 * GET /api/admin/users/:id/conversations/:conversationId — one of this
 * account's conversations and its messages (admin_user_management_spec.md
 * §7). Read-only: no read receipt, no last-seen. A conversation the account
 * is not in answers 404.
 */
export async function GET(req: Request, { params }: RouteParams) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();

    const { id, conversationId } = await params;
    const query = Object.fromEntries(new URL(req.url).searchParams);
    return ok(
      await adminUserActivityService.thread(viewer.userId, id, conversationId, query)
    );
  } catch (error) {
    return handleError(error, "Admin user conversation");
  }
}
