import { carrierService } from "@/server/services/carrier.service";
import { resolveViewer } from "@/server/services/viewer.service";
import { ok, unauthorised, handleError, fail } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/carrier-applications/:id/approve
 * Grants the carrier role and unlocks bidding. Idempotent.
 */
export async function POST(_req: Request, { params }: RouteParams) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();
    if (!viewer.isAdmin) return fail("FORBIDDEN_ROLE", "Admin only", 403);

    const { id } = await params;
    return ok(await carrierService.approve(viewer.userId, id));
  } catch (error) {
    return handleError(error, "Approve carrier");
  }
}
