import { shipmentCancellationService } from "@/server/services/shipment-cancellation.service";
import { withdrawFromJobSchema } from "@/server/dto/cancellation.dto";
import { resolveViewer } from "@/server/services/viewer.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/shipments/:id/withdraw
 *
 * The transporter hands the job back. The client's job survives it — this is
 * the whole reason it is not `cancel`.
 *
 * The carrier's, not the driver's: the award belongs to the carrier and an
 * employed driver must not be able to destroy it. The permission check lives in
 * the service, not here.
 */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();

    const { id } = await params;
    const input = withdrawFromJobSchema.parse(await req.json());

    return ok(await shipmentCancellationService.withdrawFromJob(id, input, viewer));
  } catch (error) {
    return handleError(error, "Withdraw from job");
  }
}
