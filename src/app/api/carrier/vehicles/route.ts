import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { carrierService } from "@/server/services/carrier.service";
import { createVehicleSchema } from "@/server/dto/carrier.dto";
import { ok, unauthorised, handleError } from "@/lib/api-response";

/** GET /api/carrier/vehicles — the caller's fleet. */
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    return ok(await carrierService.listVehicles(session.user.id));
  } catch (error) {
    return handleError(error, "List vehicles");
  }
}

/** POST /api/carrier/vehicles — add a vehicle. */
export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const data = createVehicleSchema.parse(await req.json());
    return ok(await carrierService.addVehicle(session.user.id, data), 201);
  } catch (error) {
    return handleError(error, "Add vehicle");
  }
}
