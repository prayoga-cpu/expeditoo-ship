import { z } from "zod";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { shipmentCancellationService } from "@/server/services/shipment-cancellation.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const revokeSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

/**
 * POST /api/listings/:id/revoke-award
 *
 * An operator takes an award back and returns the job to the board with its
 * bids intact. The permission check lives in the service, not here.
 *
 * This is the counterpart to self-accept: cancelling a shipment kills the job,
 * which is the wrong tool when the point is "somebody else should take this".
 */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { id: listingId } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const { reason } = revokeSchema.parse(await req.json().catch(() => ({})));
    const result = await shipmentCancellationService.revokeAward(
      session.user.id,
      listingId,
      reason
    );

    return ok(result);
  } catch (error) {
    return handleError(error, "Revoke award");
  }
}
