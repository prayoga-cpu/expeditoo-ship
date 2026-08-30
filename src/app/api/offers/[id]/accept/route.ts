import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { offersService } from "@/server/services/offers.service";
import { acceptOfferSchema } from "@/server/dto/offers.dto";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/offers/:id/accept
 *
 * The shipper picks a carrier, and with `slotId` says which of the carrier's
 * proposed time slots they are booking. Idempotent: re-accepting an offer that
 * already won returns the existing shipment rather than creating a second one
 * (docs/specs/offers_engine_spec.md §5).
 */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { id: offerId } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    // An offer carrying one slot has nothing to choose between, and the client
    // has always posted this with no body at all — so an unparseable body is an
    // empty one, not a 400.
    const { slotId } = acceptOfferSchema.parse(
      await req.json().catch(() => ({}))
    );

    const result = await offersService.acceptOffer(session.user.id, offerId, {
      slotId,
    });

    return ok(result, result.alreadyAccepted ? 200 : 201);
  } catch (error) {
    return handleError(error, "Accept offer");
  }
}
