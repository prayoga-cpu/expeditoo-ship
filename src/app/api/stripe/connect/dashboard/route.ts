import { auth } from "@/lib/auth";
import { stripeService } from "@/server/services/stripe.service";
import { handleError, ok, unauthorised } from "@/lib/api-response";

/**
 * GET /api/stripe/connect/dashboard
 * A login link to the driver's Stripe Express dashboard, where they manage
 * payout settings and see their balance.
 *
 * Translated through `handleError` for the same reason `POST ../connect` is:
 * every refusal used to leave here as a 500 carrying whatever prose Stripe or
 * the service had written, so "you have not finished onboarding" — the caller's
 * own state, and the most likely answer — was reported as this server breaking.
 */
export async function GET(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) return unauthorised();

    const url = await stripeService.createDashboardLink(session.user.id);

    return ok({ url });
  } catch (error) {
    return handleError(error, "GET /api/stripe/connect/dashboard");
  }
}
