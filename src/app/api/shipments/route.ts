import { z } from "zod";
import { shipmentService } from "@/server/services/shipment.service";
import { resolveViewer } from "@/server/services/viewer.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

const querySchema = z.object({
  status: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(",") : undefined))
    .pipe(
      z
        .array(
          z.enum([
            "PENDING",
            "ASSIGNED",
            "PICKED_UP",
            "IN_TRANSIT",
            "DELIVERED",
            "CANCELLED",
          ])
        )
        .optional()
    ),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/**
 * GET /api/shipments
 * Every shipment the caller is a party to, in any capacity.
 */
export async function GET(req: Request) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();

    const query = querySchema.parse(
      Object.fromEntries(new URL(req.url).searchParams)
    );

    return ok(await shipmentService.getUserShipments(viewer, query));
  } catch (error) {
    return handleError(error, "List shipments");
  }
}
