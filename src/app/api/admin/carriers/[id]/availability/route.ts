import { carrierService } from "@/server/services/carrier.service";
import { resolveViewer } from "@/server/services/viewer.service";
import { carrierAvailabilitySchema } from "@/server/dto/carrier.dto";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PUT /api/admin/carriers/:id/availability — an admin marks a driver away, or
 * back (§REQ-02). The service refuses anyone else's id as not found.
 */
export async function PUT(req: Request, { params }: RouteParams) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();

    const { id } = await params;
    const input = carrierAvailabilitySchema.parse(await req.json());
    return ok(await carrierService.setAvailability(viewer, id, input));
  } catch (error) {
    return handleError(error, "Set carrier availability");
  }
}
