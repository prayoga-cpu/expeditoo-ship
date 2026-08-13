import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { listingsService } from "@/server/services/listings.service";
import { updateListingSchema } from "@/server/dto/listings.dto";
import { hasAnyRole } from "@/server/services/user.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/listings/:id — drafts are visible only to their author. */
export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await auth.api.getSession({ headers: await headers() });

    return ok(await listingsService.getListing(id, session?.user.id ?? null));
  } catch (error) {
    return handleError(error, "Get listing");
  }
}

/**
 * PATCH /api/listings/:id
 *
 * The response reports `invalidatedOffers`, because editing what a carrier
 * priced expires their bids (transport_listing_spec.md §4).
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const { id } = await params;
    const data = updateListingSchema.parse(await req.json());

    return ok(await listingsService.updateListing(session.user.id, id, data));
  } catch (error) {
    return handleError(error, "Update listing");
  }
}

/** DELETE /api/listings/:id — drafts are removed, live jobs are cancelled. */
export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const { id } = await params;
    const isAdmin = await hasAnyRole(session.user.id, ["admin"]);

    return ok(await listingsService.cancelListing(session.user.id, id, isAdmin));
  } catch (error) {
    return handleError(error, "Cancel listing");
  }
}
