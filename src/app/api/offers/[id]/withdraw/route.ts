import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { offersService } from "@/server/services/offers.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/offers/:id/withdraw
 * Pull a live bid. The carrier may then submit one replacement.
 */
export async function POST(_req: Request, { params }: RouteParams) {
  try {
    const { id: offerId } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const offer = await offersService.withdrawOffer(session.user.id, offerId);

    return ok(offer);
  } catch (error) {
    return handleError(error, "Withdraw offer");
  }
}
