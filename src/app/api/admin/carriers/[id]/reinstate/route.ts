import { carrierService } from "@/server/services/carrier.service";
import { resolveViewer } from "@/server/services/viewer.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** POST /api/admin/carriers/:id/reinstate — « Réactiver » a suspended driver (§REQ-02). */
export async function POST(_req: Request, { params }: RouteParams) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();

    const { id } = await params;
    return ok(await carrierService.reinstate(viewer, id));
  } catch (error) {
    return handleError(error, "Reinstate carrier");
  }
}
