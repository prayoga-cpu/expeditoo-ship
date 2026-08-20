import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { stripeService } from "@/server/services/stripe.service";
import { isImpersonated } from "@/lib/impersonation-guard";

export async function POST() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Opening the "add a card" screen fires this on mount. An admin viewing the
  // account must not open a live off-session SetupIntent in the user's name.
  if (isImpersonated(session)) {
    return NextResponse.json(
      { error: "Not available while viewing another user's account" },
      { status: 403 }
    );
  }

  try {
    const { clientSecret } = await stripeService.createSetupIntent(
      session.user.id
    );
    return NextResponse.json({ clientSecret });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
