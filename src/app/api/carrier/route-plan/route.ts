import { routePlannerService } from "@/server/services/route-planner.service";
import { resolveViewer } from "@/server/services/viewer.service";
import { routePlanSchema } from "@/server/dto/route-plan.dto";
import { ok, unauthorised, handleError } from "@/lib/api-response";

/**
 * POST /api/carrier/route-plan — the driver's trip through their stops, timed
 * with and without motorways (client_feedback_2026_10_29_spec.md §N8).
 */
export async function POST(req: Request) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();
    const input = routePlanSchema.parse(await req.json());
    return ok(await routePlannerService.plan(viewer, input));
  } catch (error) {
    return handleError(error, "Plan a route");
  }
}
