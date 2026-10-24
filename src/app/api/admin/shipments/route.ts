import { shipmentService } from "@/server/services/shipment.service";
import { resolveViewer } from "@/server/services/viewer.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

/**
 * GET /api/admin/shipments — every run, with its job and its driver, for the
 * admin « Expéditions » table (client_feedback_2026_10_21_spec.md §A5).
 */
export async function GET() {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();

    return ok(await shipmentService.adminOverview(viewer));
  } catch (error) {
    return handleError(error, "Admin list shipments");
  }
}
