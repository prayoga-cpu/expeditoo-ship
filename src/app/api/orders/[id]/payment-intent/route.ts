import { auth } from "@/lib/auth";
import { ordersService } from "@/server/services/orders.service";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Parse optional paymentMethodId from body (for saved cards)
    let paymentMethodId: string | undefined;
    try {
      const body = await req.json();
      paymentMethodId = body.paymentMethodId;
    } catch {
      // Body might be empty for new card flow
    }

    const result = await ordersService.createPaymentIntent(
      id,
      session.user.id,
      paymentMethodId
    );

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to create payment intent" },
      { status: 400 }
    );
  }
}
