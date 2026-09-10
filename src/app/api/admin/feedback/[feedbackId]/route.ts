import { feedbackService } from "@/server/services/feedback.service";
import { triageFeedbackSchema } from "@/server/dto/feedback.dto";
import { resolveViewer } from "@/server/services/viewer.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ feedbackId: string }>;
}

/**
 * PATCH /api/admin/feedback/:feedbackId — status, priority, internal note.
 *
 * The id is in the path rather than the body: the sibling product PATCHes the
 * collection route with the target id inside the payload, which this repo does
 * nowhere. Access is enforced in the service (docs/rules.md §8).
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();

    const { feedbackId } = await params;
    const input = triageFeedbackSchema.parse(await req.json());

    return ok(await feedbackService.triage(feedbackId, input, viewer));
  } catch (error) {
    return handleError(error, "Triage feedback");
  }
}
