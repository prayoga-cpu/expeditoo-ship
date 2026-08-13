import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { carrierService } from "@/server/services/carrier.service";
import { updateVehicleSchema } from "@/server/dto/carrier.dto";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** PATCH /api/carrier/vehicles/:id */
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const { id } = await params;
    const data = updateVehicleSchema.parse(await req.json());

    return ok(await carrierService.updateVehicle(session.user.id, id, data));
  } catch (error) {
    return handleError(error, "Update vehicle");
  }
}

/**
 * DELETE /api/carrier/vehicles/:id
 * Blocked while a live offer names the vehicle; deactivate instead.
 */
export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const { id } = await params;
    await carrierService.deleteVehicle(session.user.id, id);

    return ok({ deleted: true });
  } catch (error) {
    return handleError(error, "Delete vehicle");
  }
}
