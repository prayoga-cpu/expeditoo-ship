import { shipmentIncidentsService } from "@/server/services/shipment-incidents.service";
import { reportIncidentSchema } from "@/server/dto/shipment-incident.dto";
import { resolveViewer } from "@/server/services/viewer.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/shipments/:id/incidents
 * "Something has gone wrong" — from the client or the transporter alike.
 * The service decides who counts as a party; this route only resolves who is
 * asking (docs/rules.md §8).
 */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();

    const { id } = await params;
    const input = reportIncidentSchema.parse(await req.json());

    return ok(await shipmentIncidentsService.report(id, input, viewer), 201);
  } catch (error) {
    return handleError(error, "Report incident");
  }
}

/** GET /api/shipments/:id/incidents — what has been reported on this run. */
export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();

    const { id } = await params;

    return ok(await shipmentIncidentsService.listForShipment(id, viewer));
  } catch (error) {
    return handleError(error, "List shipment incidents");
  }
}
