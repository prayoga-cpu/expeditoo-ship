import { recentRequestsService } from "@/server/services/recent-requests.service";
import { handleError, ok } from "@/lib/api-response";

/**
 * GET /api/public/recent-requests
 *
 * The six newest open requests, for « Demandes récentes » on the landing page
 * (docs/specs/landing_2026_11_spec.md §4). Public and unauthenticated: no
 * session is read, so the answer is the same for every visitor and the CDN
 * may serve it for a minute — the landing is the page a campaign sends
 * traffic to, and this keeps that traffic off the database. Only a success is
 * cached; an error goes out with no cache header.
 */
export const dynamic = "force-dynamic";

// Not exported: a route module may export only what Next.js recognises.
const RECENT_REQUESTS_CACHE =
  "public, max-age=0, s-maxage=60, stale-while-revalidate=120";

export async function GET() {
  try {
    const response = ok(await recentRequestsService.list());
    response.headers.set("Cache-Control", RECENT_REQUESTS_CACHE);
    return response;
  } catch (error) {
    return handleError(error, "Recent requests");
  }
}
