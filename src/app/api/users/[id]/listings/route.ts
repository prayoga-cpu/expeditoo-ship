import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { listingsService } from "@/server/services/listings.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/users/:id/listings
 * A user's live jobs - open only, so drafts and cancellations stay private -
 * each as the caller may read it. Signed-in only, and through the service
 * rather than the DAL, which returned every column and the user's whole
 * account to anyone (listing_privacy_spec.md §3).
 */
export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const { id } = await params;
    return ok(await listingsService.getOpenListingsOf(id, session.user.id));
  } catch (error) {
    return handleError(error, "Get user listings");
  }
}
