import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { carrierRoutesService } from "@/server/services/carrier-routes.service";
import { updateCarrierRouteSchema } from "@/server/dto/carrier-routes.dto";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/carrier/routes/[id] — one trip the caller owns. */
export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const { id } = await params;
    return ok(await carrierRoutesService.get(session.user.id, id));
  } catch (error) {
    return handleError(error, "Get carrier route");
  }
}

/** PATCH /api/carrier/routes/[id] — edit a trip. */
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const { id } = await params;
    const data = updateCarrierRouteSchema.parse(await req.json());

    return ok(await carrierRoutesService.update(session.user.id, id, data));
  } catch (error) {
    return handleError(error, "Update carrier route");
  }
}

/** DELETE /api/carrier/routes/[id] — drop a trip. */
export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const { id } = await params;
    return ok(await carrierRoutesService.remove(session.user.id, id));
  } catch (error) {
    return handleError(error, "Delete carrier route");
  }
}
