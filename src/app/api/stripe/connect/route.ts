import { auth } from "@/lib/auth";
import { stripeService } from "@/server/services/stripe.service";
import { handleError, ok, unauthorised } from "@/lib/api-response";

/**
 * POST /api/stripe/connect
 * Opens (or re-opens) Stripe Express onboarding for the caller.
 *
 * Every failure used to leave here as a 500 carrying Stripe's own message, so
 * a request Stripe itself had refused with a 400 was reported as this server
 * breaking, and the browser was handed prose written for the platform owner.
 * The service now throws a typed error and translation happens once, here.
 */
export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) return unauthorised();

    // Create Account (if needed)
    const accountId = await stripeService.createConnectAccount(session.user.id);

    // Create Link
    const url = await stripeService.createAccountLink(accountId);

    return ok({ url });
  } catch (error) {
    return handleError(error, "POST /api/stripe/connect");
  }
}
