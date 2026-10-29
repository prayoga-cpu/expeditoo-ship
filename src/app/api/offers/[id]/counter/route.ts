import { offersService } from "@/server/services/offers.service";
import { resolveViewer } from "@/server/services/viewer.service";
import { counterOfferSchema } from "@/server/dto/offers.dto";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/offers/:id/counter — the requester sends a price back to this
 * carrier (client_feedback_2026_10_29_spec.md §B6).
 */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();
    const { id } = await params;
    const input = counterOfferSchema.parse(await req.json());
    return ok(await offersService.counterOffer(viewer.userId, id, input));
  } catch (error) {
    return handleError(error, "Counter offer");
  }
}
