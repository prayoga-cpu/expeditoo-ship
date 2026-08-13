import { auth } from "@/lib/auth";
import { db } from "@/db";
import { user } from "@/db/schema/users";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * GET /api/users/me/stripe-status
 * Fetch current Stripe Connect status directly from database
 * This bypasses session cache to get the latest status
 */
export async function GET(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRecord = await db.query.user.findFirst({
      where: eq(user.id, session.user.id),
      columns: {
        stripeAccountId: true,
        stripeAccountStatus: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        stripeAccountId: userRecord?.stripeAccountId || null,
        stripeAccountStatus: userRecord?.stripeAccountStatus || null,
      },
    });
  } catch (error) {
    console.error("Error fetching stripe status:", error);
    return NextResponse.json(
      { error: "Failed to fetch stripe status" },
      { status: 500 }
    );
  }
}
