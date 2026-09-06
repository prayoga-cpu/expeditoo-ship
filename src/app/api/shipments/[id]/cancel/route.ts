import { shipmentCancellationService } from "@/server/services/shipment-cancellation.service";
import { cancelJobSchema } from "@/server/dto/cancellation.dto";
import { resolveViewer } from "@/server/services/viewer.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/shipments/:id/cancel
 *
 * The job is off. A transporter reaching this is answered
 * `USE_WITHDRAW_ENDPOINT`: ending a client's paid job is not theirs to do, and
 * the verb that works is next door.
 */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();

    const { id } = await params;
    const input = cancelJobSchema.parse(await req.json());

    return ok(
      await shipmentCancellationService.cancelJob(id, input, {
        kind: "session",
        viewer,
      })
    );
  } catch (error) {
    return handleError(error, "Cancel shipment");
  }
}
