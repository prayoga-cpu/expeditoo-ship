import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { offersService } from "@/server/services/offers.service";
import { threadOffersService } from "@/server/services/thread-offers.service";
import {
  createOfferSchema,
  listOffersQuerySchema,
} from "@/server/dto/offers.dto";
import { hasRole } from "@/server/services/user.service";
import { ok, unauthorised, handleError, fail } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/listings/:id/offers
 *
 * What comes back depends on who is asking: the shipper sees every bid, a
 * carrier sees only their own, and everyone else sees aggregates
 * (docs/specs/offers_engine_spec.md §6).
 */
export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { id: listingId } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    const viewerId = session?.user.id ?? null;

    const { sort } = listOffersQuerySchema.parse(
      Object.fromEntries(new URL(req.url).searchParams)
    );

    const isStaff = viewerId
      ? (await hasRole(viewerId, "admin")) || (await hasRole(viewerId, "operator"))
      : false;

    const result = await offersService.getOffersForViewer(listingId, viewerId, {
      sort,
      isStaff,
    });

    return ok(result);
  } catch (error) {
    return handleError(error, "Get offers");
  }
}

/**
 * POST /api/listings/:id/offers
 * Submit a bid on a transport job.
 */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { id: listingId } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    if (!(await hasRole(session.user.id, "carrier"))) {
      return fail("FORBIDDEN_NOT_CARRIER", "Carrier role required", 403);
    }

    const data = createOfferSchema.parse(await req.json());
    const offer = await offersService.submitOffer(
      session.user.id,
      listingId,
      data
    );

    // The bid is the fact; the card in Messages is its mirror, so a failure here
    // never refuses a bid that already committed.
    await threadOffersService
      .announceBid(
        session.user.id,
        {
          id: offer.id,
          listingId,
          priceCents: offer.priceCents,
          vehicleId: offer.vehicleId ?? null,
          message: offer.message ?? null,
        },
        { slots: data.slots, deliveryLeadDays: data.deliveryLeadDays, tzOffset: data.tzOffset },
        { name: session.user.name, image: session.user.image ?? null }
      )
      .catch((e) => console.error("[offers] announcing the bid in Messages failed", e));

    return ok(offer, 201);
  } catch (error) {
    return handleError(error, "Submit offer");
  }
}
