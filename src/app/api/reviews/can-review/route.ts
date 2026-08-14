import { z } from "zod";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { reviewsService } from "@/server/services/reviews.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

const querySchema = z.object({ shipmentId: z.string().min(1) });

/**
 * GET /api/reviews/can-review?shipmentId=xxx
 * Whether the caller may review the counterparty of this shipment. Reviews
 * hang off the shipment, not the listing (reviews.dto.ts).
 */
export async function GET(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const { shipmentId } = querySchema.parse(
      Object.fromEntries(new URL(req.url).searchParams)
    );

    return ok(await reviewsService.canReview(session.user.id, shipmentId));
  } catch (error) {
    return handleError(error, "Check can review");
  }
}
