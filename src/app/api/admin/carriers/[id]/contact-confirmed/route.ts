import { carrierService } from "@/server/services/carrier.service";
import { resolveViewer } from "@/server/services/viewer.service";
import { carrierContactConfirmedSchema } from "@/server/dto/carrier.dto";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PUT /api/admin/carriers/:id/contact-confirmed — an operator ticks or unticks
 * « Contact confirmé » on a driver application. The service decides who may.
 */
export async function PUT(req: Request, { params }: RouteParams) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();

    const { id } = await params;
    const { confirmed } = carrierContactConfirmedSchema.parse(await req.json());
    return ok(await carrierService.setContactConfirmed(viewer, id, confirmed));
  } catch (error) {
    return handleError(error, "Set carrier contact confirmed");
  }
}
