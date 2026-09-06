import { z } from "zod";
import { shipmentService } from "@/server/services/shipment.service";
import { resolveViewer } from "@/server/services/viewer.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * `CANCELLED` is deliberately absent. It used to be here, and it reached a path
 * that wrote `cancelled_at` with no reason, no side, no refund and a listing
 * left live — the exact opposite of what cancelling a job means. Ending a run
 * goes through `/cancel` or `/withdraw`, which is where the money and the board
 * are dealt with (cancellations_spec.md §7).
 */
const bodySchema = z.object({
  status: z.enum(["ASSIGNED", "PICKED_UP", "IN_TRANSIT", "DELIVERED"]),
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
