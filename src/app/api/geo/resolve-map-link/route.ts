import { z } from "zod";
import { mapLinkService } from "@/server/services/map-link.service";
import { resolveViewer } from "@/server/services/viewer.service";
import { ok, fail, unauthorised, handleError } from "@/lib/api-response";
import { rateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({ url: z.string().max(2048) });

/**
 * POST /api/geo/resolve-map-link — the "can't find your location?" escape
 * hatch on the pickup/dropoff picker. Only for a link the browser cannot
 * resolve itself (a short share link, whose coordinates only exist after a
 * redirect); a full link is already parsed client-side with no round trip.
 *
 * Requires a session, same as everything else in the create-job flow, and is
 * rate-limited per user: unlike the rest of the API, this makes the server
 * fetch a URL on the caller's behalf, so it is worth a brake even behind auth.
 */
export async function POST(req: Request) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();

    const limit = rateLimit(`resolve-map-link:${viewer.userId}`, 20, 60 * 1000);
    if (!limit.allowed) {
      return fail(
        "RATE_LIMITED",
        `Too many attempts. Try again in ${limit.retryAfter} seconds.`,
        429
      );
    }

    const { url } = bodySchema.parse(await req.json());
    return ok(await mapLinkService.resolve(url));
  } catch (error) {
    return handleError(error, "Resolve map link");
  }
}
