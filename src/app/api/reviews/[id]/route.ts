import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { reviewsService } from "@/server/services/reviews.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/reviews/:id
 * A single review.
 */
export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    return ok(await reviewsService.getReviewById(id));
  } catch (error) {
    return handleError(error, "Get review");
  }
}

/**
 * DELETE /api/reviews/:id
 * Delete own review.
 */
export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const { id } = await params;
    await reviewsService.deleteReview(id, session.user.id);

    return ok({ deleted: true });
  } catch (error) {
    return handleError(error, "Delete review");
  }
}
