import { z } from "zod";
import { shipmentService } from "@/server/services/shipment.service";
import { resolveViewer } from "@/server/services/viewer.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const bodySchema = z.object({ reason: z.string().min(3).max(500) });

/**
 * POST /api/shipments/:id/cancel
 * Once goods are on a vehicle this needs support, not self-service.
 */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();

    const { id } = await params;
    const { reason } = bodySchema.parse(await req.json());

    return ok(await shipmentService.cancelShipment(id, reason, viewer));
  } catch (error) {
    return handleError(error, "Cancel shipment");
  }
}
