import { listingsDal } from "@/server/dal/listings.dal";
import { ok, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/users/:id/listings
 * A user's public job history - open jobs only, so drafts and cancellations
 * stay private.
 */
export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    return ok(await listingsDal.getByShipperId(id, "open"));
  } catch (error) {
    return handleError(error, "Get user listings");
  }
}
