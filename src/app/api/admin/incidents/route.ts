import { shipmentIncidentsService } from "@/server/services/shipment-incidents.service";
import { incidentQuerySchema } from "@/server/dto/shipment-incident.dto";
import { resolveViewer } from "@/server/services/viewer.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

/**
 * GET /api/admin/incidents
 * The operator queue. Staff-only, enforced in the service — a role check
 * inlined here would be the one place it could drift (CLAUDE.md §Architecture).
 */
export async function GET(req: Request) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();

    const query = incidentQuerySchema.parse(
      Object.fromEntries(new URL(req.url).searchParams)
    );

    return ok(await shipmentIncidentsService.listQueue(query, viewer));
  } catch (error) {
    return handleError(error, "List incident queue");
  }
}
