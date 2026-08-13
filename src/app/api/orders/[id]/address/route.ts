import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  ordersService,
  OrderNotFoundError,
  OrderAccessDeniedError,
  InvalidOrderStateError,
} from "@/server/services/orders.service";
import { setDeliveryAddressSchema } from "@/server/dto/orders.dto";

/**
 * POST /api/orders/[id]/address
 * Set delivery address for order
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    // Validate input
    const validatedData = setDeliveryAddressSchema.safeParse(body);
    if (!validatedData.success) {
      return NextResponse.json(
        { success: false, error: validatedData.error.errors[0].message },
        { status: 400 }
      );
    }

    const order = await ordersService.setDeliveryAddress(
      id,
      validatedData.data.address,
      session.user.id,
      validatedData.data.lat,
      validatedData.data.lng
    );

    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    if (error instanceof OrderNotFoundError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      );
    }
    if (error instanceof OrderAccessDeniedError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 403 }
      );
    }
    if (error instanceof InvalidOrderStateError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }
    console.error("Error setting delivery address:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
