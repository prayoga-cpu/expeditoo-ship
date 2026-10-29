import { carrierService } from "@/server/services/carrier.service";
import { resolveViewer } from "@/server/services/viewer.service";
import { carrierAvailabilitySchema } from "@/server/dto/carrier.dto";
import { ok, unauthorised, handleError } from "@/lib/api-response";

/**
 * PUT /api/carrier/availability — « Je suis absent » on or off, for the
 * caller's own driver account (client_feedback_2026_10_29_spec.md §REQ-02).
 */
export async function PUT(req: Request) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();

    const input = carrierAvailabilitySchema.parse(await req.json());
    return ok(await carrierService.setAvailability(viewer, null, input));
  } catch (error) {
    return handleError(error, "Set own availability");
  }
}
