import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { offersService } from "@/server/services/offers.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/offers/:id/accept
 *
 * The shipper picks a carrier. Idempotent: re-accepting an offer that already
 * won returns the existing shipment rather than creating a second one
 * (docs/specs/offers_engine_spec.md §5).
 */
export async function POST(_req: Request, { params }: RouteParams) {
  try {
    const { id: offerId } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const result = await offersService.acceptOffer(session.user.id, offerId);

    return ok(result, result.alreadyAccepted ? 200 : 201);
  } catch (error) {
    return handleError(error, "Accept offer");
  }
}
