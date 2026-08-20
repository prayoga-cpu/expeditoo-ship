import { resolveViewer } from "@/server/services/viewer.service";
import { updateUserStatus } from "@/server/services/admin.service";
import { updateUserStatusInputSchema } from "@/server/dto/admin.dto";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/admin/users/:id/status
 *
 * Suspend or reinstate. Suspending also drops the user's live sessions, so it
 * takes effect now rather than whenever their current session happens to end.
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();

    const { id } = await params;
    const { banned } = updateUserStatusInputSchema.parse(await req.json());

    return ok(await updateUserStatus(id, banned, viewer.userId));
  } catch (error) {
    return handleError(error, "Update user status");
  }
}
