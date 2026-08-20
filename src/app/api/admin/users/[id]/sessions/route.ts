import { resolveViewer } from "@/server/services/viewer.service";
import { revokeUserSessions } from "@/server/services/admin.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/admin/users/:id/sessions
 * Signs the user out of every device. Their account is otherwise untouched.
 */
export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();

    const { id } = await params;

    return ok(await revokeUserSessions(id, viewer.userId));
  } catch (error) {
    return handleError(error, "Revoke user sessions");
  }
}
