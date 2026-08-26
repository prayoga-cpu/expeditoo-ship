import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  withdrawalsService,
  decideWithdrawalSchema,
} from "@/server/services/withdrawals.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/withdrawals/:id
 *
 * Approve, refuse, or record that the transfer was made. `mark_paid` demands a
 * reference — a payment recorded with nothing to reconcile it against is worse
 * than one not recorded at all.
 */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const input = decideWithdrawalSchema.parse(await req.json());

    return ok(await withdrawalsService.decide(session.user.id, id, input));
  } catch (error) {
    return handleError(error, "Decide withdrawal");
  }
}
