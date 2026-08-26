import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { carrierRoutesService } from "@/server/services/carrier-routes.service";
import { createCarrierRouteSchema } from "@/server/dto/carrier-routes.dto";
import { ok, unauthorised, handleError } from "@/lib/api-response";

/** GET /api/carrier/routes — the caller's declared trips. */
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    return ok(await carrierRoutesService.list(session.user.id));
  } catch (error) {
    return handleError(error, "List carrier routes");
  }
}

/** POST /api/carrier/routes — declare a trip. */
export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const data = createCarrierRouteSchema.parse(await req.json());
    return ok(await carrierRoutesService.create(session.user.id, data), 201);
  } catch (error) {
    return handleError(error, "Create carrier route");
  }
}
