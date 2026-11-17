import { carrierService } from "@/server/services/carrier.service";
import { resolveViewer } from "@/server/services/viewer.service";
import { createVehicleSchema } from "@/server/dto/carrier.dto";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** POST /api/admin/carriers/:id/vehicles — staff add a vehicle to a driver's file. */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();

    const { id } = await params;
    const data = createVehicleSchema.parse(await req.json());
    return ok(await carrierService.adminAddVehicle(viewer, id, data));
  } catch (error) {
    return handleError(error, "Add vehicle to carrier");
  }
}
