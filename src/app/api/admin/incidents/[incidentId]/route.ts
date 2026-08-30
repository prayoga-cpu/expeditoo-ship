import { shipmentIncidentsService } from "@/server/services/shipment-incidents.service";
import { updateIncidentSchema } from "@/server/dto/shipment-incident.dto";
import { resolveViewer } from "@/server/services/viewer.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ incidentId: string }>;
}

/**
 * PATCH /api/admin/incidents/:incidentId
 * Acknowledge or resolve. The parties report; operators decide.
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();

    const { incidentId } = await params;
    const input = updateIncidentSchema.parse(await req.json());

    return ok(
      await shipmentIncidentsService.updateStatus(incidentId, input, viewer)
    );
  } catch (error) {
    return handleError(error, "Update incident");
  }
}
