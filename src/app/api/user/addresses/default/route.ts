import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { addressesService } from "@/server/services/addresses.service";

/**
 * GET /api/user/addresses/default
 * Get default address for current user
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    const address = await addressesService.getDefaultAddress(session.user.id);

    return NextResponse.json({
      success: true,
      data: address, // Can be null if no default address
    });
  } catch (error) {
    console.error("[API] GET /api/user/addresses/default error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get default address",
        },
      },
      { status: 500 }
    );
  }
}
