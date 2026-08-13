import { auth } from "@/lib/auth";
import { stripeService } from "@/server/services/stripe.service";
import { NextResponse } from "next/server";

/**
 * GET /api/stripe/connect/dashboard
 * Get a login link to the Stripe Express dashboard
 * User can manage payout settings, view balance, etc.
 */
export async function GET(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = await stripeService.createDashboardLink(session.user.id);

    return NextResponse.json({
      success: true,
      data: { url },
    });
  } catch (error: any) {
    console.error("Error creating dashboard link:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create dashboard link" },
      { status: 500 }
    );
  }
}
