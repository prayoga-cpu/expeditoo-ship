import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { carrierDiscoveryService } from "@/server/services/carrier-discovery.service";
import { rateLimit } from "@/lib/rate-limit";
import { ok, fail, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string; matchId: string }>;
}

/**
 * Twenty contacts per job per hour, per caller.
 *
 * A panel of thirty buttons is a different threat model from a page with one:
 * the cap is per listing rather than per address so that working through a
 * genuine list of matches stays possible while messaging a whole pool on a
 * loop does not.
 */
const LIMIT = 20;
const WINDOW_MS = 60 * 60 * 1000;

/**
 * POST /api/listings/:id/carriers/:matchId/contact — open a thread about this
 * job with the carrier behind `matchId`.
 *
 * `matchId` is authorisation rather than a lookup key: the service re-runs the
 * match and refuses one it does not produce, so this is not a carrier
 * directory (carriers_on_route_spec.md §6.2).
 */
export async function POST(_req: Request, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const { id, matchId } = await params;

    const limit = rateLimit(
      `carrier-contact:${id}:${session.user.id}`,
      LIMIT,
      WINDOW_MS
    );
    if (!limit.allowed) {
      return fail(
        "CONTACT_RATE_LIMITED",
        `Too many contacts. Try again in ${limit.retryAfter} seconds.`,
        429
      );
    }

    return ok(
      await carrierDiscoveryService.contact(session.user.id, id, matchId),
      201
    );
  } catch (error) {
    return handleError(error, "Contact carrier on route");
  }
}
