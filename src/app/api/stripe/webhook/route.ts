import { stripeService } from "@/server/services/stripe.service";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.text();
  const sig = (await headers()).get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  try {
    await stripeService.handleWebhook(body, sig);
    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Webhook Error:", error.message);
    return NextResponse.json(
      { error: `Webhook Handler Error: ${error.message}` },
      { status: 400 }
    );
  }
}
