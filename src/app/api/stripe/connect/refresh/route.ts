import { auth } from "@/lib/auth";
import { stripeService } from "@/server/services/stripe.service";
import { isImpersonated } from "@/lib/impersonation-guard";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      // Can't redirect with proper context if no session, but refresh flow implies user is present
      return NextResponse.redirect(new URL("/profile?stripe=error", req.url));
    }

    // The only GET in the codebase that creates a Stripe account. Reachable by
    // typing the URL or by a stale Stripe redirect, so an admin viewing an
    // account could provision a real Express account in that person's name.
    if (isImpersonated(session)) {
      return NextResponse.redirect(new URL("/profile?stripe=error", req.url));
    }

    const { user } = session;

    // Check if user has accountId
    // We need to fetch from DB or check session if extended
    // For now assuming we call the service again which handles it
    const accountId = await stripeService.createConnectAccount(user.id);
    const link = await stripeService.createAccountLink(accountId);

    return NextResponse.redirect(link);
  } catch (error) {
    return NextResponse.redirect(new URL("/profile?stripe=error", req.url));
  }
}
