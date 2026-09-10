/**
 * POST /api/shipments/:id/confirm
 *
 * The client attests a milestone from the delivery screen they are already
 * signed in to, rather than having to find the SMS or the email again.
 *
 * The third door onto one fact, not a new power: like the other two it records
 * a `shipment_confirmations` row and moves nothing — no status, no event, no
 * payment, no listing (transport_status_confirmation_spec.md §1).
 *
 * The route resolves the session and hands it down; the service decides
 * whether this caller may answer for this shipment, and derives who they
 * answered as (docs/rules.md §1.4).
 */

import { shipmentConfirmationsService } from "@/server/services/shipment-confirmations.service";
import { resolveViewer } from "@/server/services/viewer.service";
import { confirmMilestoneBodySchema } from "@/server/dto/shipment.dto";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();

    const { id } = await params;
    const input = confirmMilestoneBodySchema.parse(await req.json());

    return ok(
      await shipmentConfirmationsService.attestInApp(id, viewer, input)
    );
  } catch (error) {
    return handleError(error, "Confirm shipment milestone");
  }
}
