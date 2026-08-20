import { resolveViewer } from "@/server/services/viewer.service";
import { deleteUserAccount } from "@/server/services/admin.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/admin/users/:id
 *
 * Hard delete. Everything keyed to the user cascades away with the row --
 * see docs/specs/admin_user_management_spec.md §2.2 for what survives (nothing)
 * and who cannot be deleted (admins, the acting admin, the system account).
 */
export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();

    const { id } = await params;

    return ok(await deleteUserAccount(id, viewer.userId));
  } catch (error) {
    return handleError(error, "Delete user");
  }
}
