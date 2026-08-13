import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { addressesService } from "@/server/services/addresses.service";

/**
 * GET /api/user/addresses
 * Get all addresses for current user
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

    const addresses = await addressesService.getByUserId(session.user.id);

    return NextResponse.json({
      success: true,
      data: addresses,
    });
  } catch (error) {
    console.error("[API] GET /api/user/addresses error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get addresses",
        },
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/addresses
 * Create a new address for current user
 */
export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const address = await addressesService.create(session.user.id, body);

    return NextResponse.json({
      success: true,
      data: address,
    });
  } catch (error) {
    console.error("[API] POST /api/user/addresses error:", error);

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid input" },
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create address",
        },
      },
      { status: 500 }
    );
  }
}
