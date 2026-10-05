import { z } from "zod";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { offersService } from "@/server/services/offers.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const takeJobSchema = z.object({
  vehicleId: z.string().min(1),
  message: z.string().trim().max(500).optional(),
});

/**
 * POST /api/listings/:id/take
 *
 * An approved carrier takes an open job outright at the posted budget, instead
 * of bidding and waiting to be picked.
 *
 * Escalated jobs only. A direct request is awarded by its requester, so taking
 * one is refused with TAKE_NOT_AVAILABLE (take_job_spec.md) — by the service,
 * like every other rule about who may award, never here.
 *
 * Two drivers tapping this at the same moment is the expected case, not the
 * edge case: both mint an offer, both reach the award, and the second is
 * refused by the row lock with LISTING_NOT_OPEN.
 *
 * Answers `{ offer, shipment: { id }, alreadyAccepted }`: the carrier's own
 * offer, never the rival bids the award rejected (take_job_spec.md §2).
 */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { id: listingId } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const data = takeJobSchema.parse(await req.json());
    const result = await offersService.takeJob(session.user.id, listingId, data);

    return ok(result, 201);
  } catch (error) {
    return handleError(error, "Take job");
  }
}
