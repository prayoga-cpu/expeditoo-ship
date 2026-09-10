import { feedbackService } from "@/server/services/feedback.service";
import { feedbackQuerySchema } from "@/server/dto/feedback.dto";
import { resolveViewer } from "@/server/services/viewer.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

/**
 * GET /api/admin/feedback — the triage queue.
 *
 * Filtering, ordering, counting and paging all happen in SQL; the response
 * carries the five status counts alongside the page so the console's tiles can
 * never disagree with the list. Access is enforced in the service, not here.
 */
export async function GET(req: Request) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();

    const query = feedbackQuerySchema.parse(
      Object.fromEntries(new URL(req.url).searchParams)
    );

    return ok(await feedbackService.listQueue(query, viewer));
  } catch (error) {
    return handleError(error, "List feedback queue");
  }
}
