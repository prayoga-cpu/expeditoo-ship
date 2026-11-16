import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { assistRequestSchema } from "@/server/dto/request-assistant.dto";
import { requestAssistantService } from "@/server/services/request-assistant.service";
import { ok, fail, unauthorised, handleError } from "@/lib/api-response";
import { rateLimit } from "@/lib/rate-limit";

/**
 * GET /api/listings/assist — whether the request assistant can answer, so the
 * form shows its box only where it works (request_assistant_spec.md §3.1).
 */
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    return ok({ available: requestAssistantService.isAvailable() });
  } catch (error) {
    return handleError(error, "Request assistant availability");
  }
}

/**
 * POST /api/listings/assist — a description of a request, read into values
 * the `/create` form can be filled with. Creates nothing.
 *
 * Signed-in only and rate-limited per user: every call is a paid model call
 * and four map lookups made on the caller's behalf.
 */
export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const limit = rateLimit(`request-assist:${session.user.id}`, 10, 60 * 1000);
    if (!limit.allowed) {
      return fail(
        "RATE_LIMITED",
        `Too many attempts. Try again in ${limit.retryAfter} seconds.`,
        429
      );
    }

    const { text } = assistRequestSchema.parse(await req.json());
    return ok(await requestAssistantService.understand(text));
  } catch (error) {
    return handleError(error, "Request assistant");
  }
}
