import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { listingsService } from "@/server/services/listings.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/listings/:id/repost — an ended request copied into a new draft,
 * to post it again (docs/specs/no_dead_ends_spec.md §3). Answers the draft's id.
 */
export async function POST(_req: Request, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const { id } = await params;
    return ok(await listingsService.repostAsDraft(session.user.id, id));
  } catch (error) {
    return handleError(error, "Repost listing");
  }
}
