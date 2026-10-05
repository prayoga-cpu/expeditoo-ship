import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { carrierService } from "@/server/services/carrier.service";
import { carrierBankingSchema } from "@/server/dto/carrier.dto";
import { ok, unauthorised, handleError } from "@/lib/api-response";

/**
 * POST /api/carrier/banking
 * The full IBAN/BIC is validated and discarded; only the last 4 characters of
 * each are persisted. Nothing is forwarded anywhere — not to Stripe, not to a
 * bank — so no driver is paid from what this stores
 * (payout_safety_spec.md §6).
 */
export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const data = carrierBankingSchema.parse(await req.json());
    return ok(await carrierService.setBanking(session.user.id, data));
  } catch (error) {
    return handleError(error, "Set carrier banking");
  }
}
