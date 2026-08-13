import { auth } from "@/lib/auth";
import { stripeService } from "@/server/services/stripe.service";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { user } = session;

    // Create Account (if needed)
    const accountId = await stripeService.createConnectAccount(user.id);

    // Create Link
    const accountLink = await stripeService.createAccountLink(accountId);

    return NextResponse.json({ url: accountLink });
  } catch (error: any) {
    console.error("Stripe Connect Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to start onboarding" },
      { status: 500 }
    );
  }
}
