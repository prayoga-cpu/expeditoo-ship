import { z } from "zod";
import { carrierStatusEnum } from "@/db/schema/carriers";
import { carrierService } from "@/server/services/carrier.service";
import { resolveViewer } from "@/server/services/viewer.service";
import { ok, unauthorised, handleError, fail } from "@/lib/api-response";

// Derived from the schema enum — never restate the status list here.
const querySchema = z.object({
  status: z.enum(carrierStatusEnum.enumValues).optional(),
});

/** GET /api/admin/carrier-applications — the review queue; unfiltered by default. */
export async function GET(req: Request) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();
    if (!viewer.isAdmin && !viewer.isOperator) {
      return fail("FORBIDDEN_ROLE", "Admin access required", 403);
    }

    const { status } = querySchema.parse(
      Object.fromEntries(new URL(req.url).searchParams)
    );

    return ok(await carrierService.listForReview(status));
  } catch (error) {
    return handleError(error, "List carrier applications");
  }
}
