import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { carrierService } from "@/server/services/carrier.service";
import { upsertCarrierSchema } from "@/server/dto/carrier.dto";
import { ok, unauthorised, handleError } from "@/lib/api-response";

/** GET /api/carrier/application — the caller's own application. */
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    return ok(await carrierService.getOwnApplication(session.user.id));
  } catch (error) {
    return handleError(error, "Get carrier application");
  }
}

/** POST /api/carrier/application — create or update the draft. */
export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const data = upsertCarrierSchema.parse(await req.json());
    return ok(await carrierService.upsertApplication(session.user.id, data));
  } catch (error) {
    return handleError(error, "Upsert carrier application");
  }
}
