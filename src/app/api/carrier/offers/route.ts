import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { offersService } from "@/server/services/offers.service";
import { carrierOffersQuerySchema } from "@/server/dto/offers.dto";
import { hasRole } from "@/server/services/user.service";
import { ok, unauthorised, handleError, fail } from "@/lib/api-response";

/**
 * GET /api/carrier/offers
 * The authenticated carrier's own bids across every job.
 */
export async function GET(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    if (!(await hasRole(session.user.id, "carrier"))) {
      return fail("FORBIDDEN_NOT_CARRIER", "Carrier role required", 403);
    }

    const query = carrierOffersQuerySchema.parse(
      Object.fromEntries(new URL(req.url).searchParams)
    );

    const offers = await offersService.getCarrierOffers(session.user.id, query);

    return ok(offers);
  } catch (error) {
    return handleError(error, "Get carrier offers");
  }
}
