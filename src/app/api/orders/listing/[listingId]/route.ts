import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  ordersService,
  OrderNotFoundError,
  OrderAccessDeniedError,
} from "@/server/services/orders.service";

/**
 * GET /api/orders/listing/[listingId]
 * Get order by listing ID (for checkout page)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ listingId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { listingId } = await params;
    const order = await ordersService.getOrderByListingId(
      listingId,
      session.user.id
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
    console.error("Error getting order by listing:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
