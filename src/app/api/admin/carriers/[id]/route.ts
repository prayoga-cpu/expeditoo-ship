import { carrierService } from "@/server/services/carrier.service";
import { resolveViewer } from "@/server/services/viewer.service";
import { upsertCarrierSchema } from "@/server/dto/carrier.dto";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/admin/carriers/:id — staff complete or correct a driver's file on
 * the applicant's behalf (driver_types_spec.md §7). The service decides who may.
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();

    const { id } = await params;
    const data = upsertCarrierSchema.parse(await req.json());
    return ok(await carrierService.adminUpdateApplication(viewer, id, data));
  } catch (error) {
    return handleError(error, "Update carrier application");
  }
}
