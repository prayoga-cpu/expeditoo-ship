import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { reviewsService } from "@/server/services/reviews.service";
import {
  createReviewSchema,
  reviewsQuerySchema,
} from "@/server/dto/reviews.dto";
import { ok, unauthorised, handleError } from "@/lib/api-response";

/**
 * POST /api/reviews
 * Review the counterparty of a delivered shipment.
 */
export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const input = createReviewSchema.parse(await req.json());

    return ok(await reviewsService.createReview(session.user.id, input), 201);
  } catch (error) {
    return handleError(error, "Create review");
  }
}

/**
 * GET /api/reviews
 * Reviews written by the caller.
 */
export async function GET(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const query = reviewsQuerySchema.parse(
      Object.fromEntries(new URL(req.url).searchParams)
    );

    return ok(await reviewsService.getAuthoredReviews(session.user.id, query));
  } catch (error) {
    return handleError(error, "Get reviews");
  }
}
