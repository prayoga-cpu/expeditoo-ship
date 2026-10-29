import { carrierService } from "@/server/services/carrier.service";
import { resolveViewer } from "@/server/services/viewer.service";
import { deregisterSelfSchema } from "@/server/dto/carrier.dto";
import { ok, unauthorised, handleError } from "@/lib/api-response";

/**
 * POST /api/carrier/deregister — « Me désinscrire » (§REQ-02). Refused while a
 * run is still owed (CARRIER_HAS_LIVE_RUNS); standing bids are withdrawn.
 */
export async function POST(req: Request) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();

    const { reason } = deregisterSelfSchema.parse(await req.json());
    return ok(await carrierService.deregister(viewer, null, reason));
  } catch (error) {
    return handleError(error, "Deregister own account");
  }
}
