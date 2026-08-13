import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { addressesService } from "@/server/services/addresses.service";

/**
 * POST /api/user/addresses/[id]/set-default
 * Set an address as default
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const address = await addressesService.setAsDefault(id, session.user.id);

    return NextResponse.json({
      success: true,
      data: address,
    });
  } catch (error) {
    console.error(
      "[API] POST /api/user/addresses/[id]/set-default error:",
      error
    );

    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return NextResponse.json(
          {
            success: false,
            error: { code: "NOT_FOUND", message: error.message },
          },
          { status: 404 }
        );
      }
      if (error.message.includes("Not authorized")) {
        return NextResponse.json(
          {
            success: false,
            error: { code: "FORBIDDEN", message: error.message },
          },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to set default address",
        },
      },
      { status: 500 }
    );
  }
}
