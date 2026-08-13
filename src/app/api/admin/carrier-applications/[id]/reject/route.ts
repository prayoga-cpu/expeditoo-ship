import { carrierService } from "@/server/services/carrier.service";
import { resolveViewer } from "@/server/services/viewer.service";
import { rejectCarrierSchema } from "@/server/dto/carrier.dto";
import { ok, unauthorised, handleError, fail } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** POST /api/admin/carrier-applications/:id/reject — reason is mandatory. */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();
    if (!viewer.isAdmin) return fail("FORBIDDEN_ROLE", "Admin only", 403);

    const { id } = await params;
    const { reason } = rejectCarrierSchema.parse(await req.json());

    return ok(await carrierService.reject(viewer.userId, id, reason));
  } catch (error) {
    return handleError(error, "Reject carrier");
  }
}
