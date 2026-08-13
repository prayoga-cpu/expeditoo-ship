import { z } from "zod";
import { shipmentService } from "@/server/services/shipment.service";
import { resolveViewer } from "@/server/services/viewer.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const bodySchema = z.object({
  status: z.enum([
    "ASSIGNED",
    "PICKED_UP",
    "IN_TRANSIT",
    "DELIVERED",
    "CANCELLED",
  ]),
  note: z.string().max(500).optional(),
});

/**
 * PATCH /api/shipments/:id/status
 * Advance the run. Legal transitions are enforced in the service.
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();

    const { id } = await params;
    const { status, note } = bodySchema.parse(await req.json());

    return ok(await shipmentService.updateStatus(id, status, viewer, note));
  } catch (error) {
    return handleError(error, "Update shipment status");
  }
}
