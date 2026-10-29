import { offersService } from "@/server/services/offers.service";
import { resolveViewer } from "@/server/services/viewer.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/offers/:id/propose — an operator recommends this offer to the
 * requester of a direct request, who still pays to confirm it
 * (client_feedback_2026_10_29_spec.md §B1).
 */
export async function POST(_req: Request, { params }: RouteParams) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();
    const { id } = await params;
    return ok(await offersService.proposeOffer(viewer, id));
  } catch (error) {
    return handleError(error, "Propose offer");
  }
}

/** DELETE /api/offers/:id/propose — takes the recommendation back. */
export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();
    const { id } = await params;
    return ok(await offersService.withdrawProposal(viewer, id));
  } catch (error) {
    return handleError(error, "Withdraw proposal");
  }
}
