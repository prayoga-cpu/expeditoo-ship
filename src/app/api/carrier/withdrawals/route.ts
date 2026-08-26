import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { withdrawalsService } from "@/server/services/withdrawals.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

/**
 * GET /api/carrier/withdrawals
 *
 * The driver's balance, any open request, and their history. One call, because
 * the screen renders all three together and a balance without its open request
 * is a number that invites a second, duplicate withdrawal.
 */
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    return ok(await withdrawalsService.getBalance(session.user.id));
  } catch (error) {
    return handleError(error, "Withdrawal balance");
  }
}

/**
 * POST /api/carrier/withdrawals
 *
 * Ask for everything currently available. No body: the amount is every
 * unclaimed payout, frozen at request time.
 */
export async function POST() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    return ok(await withdrawalsService.request(session.user.id), 201);
  } catch (error) {
    return handleError(error, "Request withdrawal");
  }
}
