import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { carrierService } from "@/server/services/carrier.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

/** POST /api/carrier/application/withdraw — pull a submitted file back to draft. */
export async function POST() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    return ok(await carrierService.withdrawApplication(session.user.id));
  } catch (error) {
    return handleError(error, "Withdraw carrier application");
  }
}
