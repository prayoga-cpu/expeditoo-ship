import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { listingsService } from "@/server/services/listings.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/listings/:id/unschedule — a scheduled request back to a draft, its
 * schedule cleared (docs/specs/draft_requests_spec.md §4).
 */
export async function POST(_req: Request, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const { id } = await params;
    return ok(await listingsService.unschedule(session.user.id, id));
  } catch (error) {
    return handleError(error, "Unschedule listing");
  }
}
