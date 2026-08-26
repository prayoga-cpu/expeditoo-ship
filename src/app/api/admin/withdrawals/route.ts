import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { withdrawalsService } from "@/server/services/withdrawals.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

/**
 * GET /api/admin/withdrawals?status=requested
 *
 * The review queue. The permission check lives in the service.
 */
export async function GET(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const status =
      new URL(req.url).searchParams.get("status") ?? undefined;

    return ok(await withdrawalsService.listForReview(session.user.id, status));
  } catch (error) {
    return handleError(error, "List withdrawals");
  }
}
