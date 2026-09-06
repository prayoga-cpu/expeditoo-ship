import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { carrierDiscoveryService } from "@/server/services/carrier-discovery.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/listings/:id/carriers — the approved carriers whose declared
 * trajet covers this job inside its pickup window.
 *
 * Who may ask is the service's call: the owner, or an operator standing in for
 * the Expedion client (carriers_on_route_spec.md §5.2).
 */
export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const { id } = await params;

    return ok(await carrierDiscoveryService.listForListing(session.user.id, id));
  } catch (error) {
    return handleError(error, "List carriers on route");
  }
}
