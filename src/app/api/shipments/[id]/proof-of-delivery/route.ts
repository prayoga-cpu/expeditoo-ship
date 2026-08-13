import { z } from "zod";
import { shipmentService } from "@/server/services/shipment.service";
import { resolveViewer } from "@/server/services/viewer.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const bodySchema = z.object({ url: z.string().url() });

/**
 * POST /api/shipments/:id/proof-of-delivery
 * Closes the run and evidences it for any later dispute.
 */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();

    const { id } = await params;
    const { url } = bodySchema.parse(await req.json());

    return ok(await shipmentService.uploadProofOfDelivery(id, url, viewer));
  } catch (error) {
    return handleError(error, "Upload proof of delivery");
  }
}
