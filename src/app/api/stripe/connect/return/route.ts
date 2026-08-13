import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { stripeService } from "@/server/services/stripe.service";

const HOST_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session?.user?.id) {
    console.log("Stripe Return: Checking status for user", session.user.id);
    // Manually force a status check since webhooks might not trigger locally
    await stripeService.checkAccountStatus(session.user.id);
  } else {
    console.log("Stripe Return: No session found");
  }

  // On successful return, just redirect to profile
  // The check above should have updated the status if account is ready
  return NextResponse.redirect(`${HOST_URL}/profile?stripe=success`);
}
