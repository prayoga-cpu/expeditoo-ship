import { resolveViewer } from "@/server/services/viewer.service";
import { userContactService } from "@/server/services/user-contact.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/users/:id/contact — an account's names and phones, for staff
 * (client_feedback_2026_10_spec.md §7b). The service refuses anyone else.
 */
export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();

    const { id } = await params;
    return ok(await userContactService.getForStaff(viewer, id));
  } catch (error) {
    return handleError(error, "Get contact details for staff");
  }
}
