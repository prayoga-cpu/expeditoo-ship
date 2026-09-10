import { feedbackService } from "@/server/services/feedback.service";
import { submitFeedbackSchema } from "@/server/dto/feedback.dto";
import { resolveViewer } from "@/server/services/viewer.service";
import { ok, fail, unauthorised, handleError } from "@/lib/api-response";
import { rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/feedback — anyone signed in may write to us.
 *
 * No role logic here: access is enforced in the service (docs/rules.md §8).
 */
export async function POST(req: Request) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();

    // Keyed on the user rather than the IP: they are authenticated, so the id
    // is the honest key and a shared office network is not punished. The
    // counter lives in one instance's heap (see rate-limit.ts), so this is a
    // brake on casual abuse, not a security control.
    const limit = rateLimit(`feedback:${viewer.userId}`, 10, 60 * 60 * 1000);
    if (!limit.allowed) {
      return fail(
        "FEEDBACK_RATE_LIMITED",
        `Too much feedback at once. Try again in ${limit.retryAfter} seconds.`,
        429
      );
    }

    const input = submitFeedbackSchema.parse(await req.json());

    return ok(await feedbackService.submit(input, viewer), 201);
  } catch (error) {
    return handleError(error, "Submit feedback");
  }
}

/** GET /api/feedback — what I have sent, and where it got to. */
export async function GET() {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();

    return ok(await feedbackService.listMine(viewer));
  } catch (error) {
    return handleError(error, "List my feedback");
  }
}
