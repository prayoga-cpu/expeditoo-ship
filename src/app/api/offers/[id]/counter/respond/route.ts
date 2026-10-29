import { offersService } from "@/server/services/offers.service";
import { resolveViewer } from "@/server/services/viewer.service";
import { counterResponseSchema } from "@/server/dto/offers.dto";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/offers/:id/counter/respond — the carrier accepts, declines or
 * answers the requester's counter-price (§B6).
 */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();
    const { id } = await params;
    const input = counterResponseSchema.parse(await req.json());
    return ok(await offersService.respondToCounter(viewer.userId, id, input));
  } catch (error) {
    return handleError(error, "Respond to counter offer");
  }
}
