import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { stripeStatusService } from "@/server/services/stripe-status.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

/**
 * GET /api/admin/stripe-status
 *
 * Whether this deployment is ready to take real card payments: key mode,
 * the Stripe account, the webhook endpoints, the last event received and the
 * first real charge (launch_readiness_spec.md §B). Admin or finance only.
 * Read-only; no key or secret is ever returned.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    return ok(await stripeStatusService.getForAdmin(session.user.id));
  } catch (error) {
    return handleError(error, "Stripe status");
  }
}
