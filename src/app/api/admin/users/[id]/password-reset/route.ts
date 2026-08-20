import { resolveViewer } from "@/server/services/viewer.service";
import { sendPasswordResetForUser } from "@/server/services/admin.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/users/:id/password-reset
 * Mails the user a reset link. The admin never sees or sets the password.
 */
export async function POST(_req: Request, { params }: RouteParams) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();

    const { id } = await params;

    return ok(await sendPasswordResetForUser(id, viewer.userId));
  } catch (error) {
    return handleError(error, "Send password reset");
  }
}
