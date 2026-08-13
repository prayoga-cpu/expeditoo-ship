import { z } from "zod";
import { shipmentService } from "@/server/services/shipment.service";
import { resolveViewer } from "@/server/services/viewer.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const bodySchema = z.object({ driverId: z.string().min(1) });

/**
 * POST /api/shipments/:id/assign
 * The carrier nominates one of its own drivers to run the job.
 */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();

    const { id } = await params;
    const { driverId } = bodySchema.parse(await req.json());

    return ok(await shipmentService.assignDriver(id, driverId, viewer));
  } catch (error) {
    return handleError(error, "Assign driver");
  }
}
