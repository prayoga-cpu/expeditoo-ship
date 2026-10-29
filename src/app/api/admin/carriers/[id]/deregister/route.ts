import { carrierService } from "@/server/services/carrier.service";
import { resolveViewer } from "@/server/services/viewer.service";
import { deregisterCarrierSchema } from "@/server/dto/carrier.dto";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** POST /api/admin/carriers/:id/deregister — « Désinscrire », with a reason (§REQ-02). */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();

    const { id } = await params;
    const { reason } = deregisterCarrierSchema.parse(await req.json());
    return ok(await carrierService.deregister(viewer, id, reason));
  } catch (error) {
    return handleError(error, "Deregister carrier");
  }
}
