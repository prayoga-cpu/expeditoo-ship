import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { listingsService } from "@/server/services/listings.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/listings/:id/unpublish — a live request back to a draft, so its
 * owner can change it; its pending offers are withdrawn and their carriers
 * told (docs/specs/no_dead_ends_spec.md §2).
 */
export async function POST(_req: Request, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const { id } = await params;
    return ok(await listingsService.unpublish(session.user.id, id));
  } catch (error) {
    return handleError(error, "Unpublish listing");
  }
}
