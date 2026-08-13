import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { addressesService } from "@/server/services/addresses.service";

/**
 * GET /api/user/addresses/[id]
 * Get a single address by ID
 */
export async function GET(
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
    const address = await addressesService.getById(id, session.user.id);

    return NextResponse.json({
      success: true,
      data: address,
    });
  } catch (error) {
    console.error("[API] GET /api/user/addresses/[id] error:", error);

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
          message: "Failed to get address",
        },
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/user/addresses/[id]
 * Update an address
 */
export async function PATCH(
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
    const body = await req.json();
    const address = await addressesService.update(id, session.user.id, body);

    return NextResponse.json({
      success: true,
      data: address,
    });
  } catch (error) {
    console.error("[API] PATCH /api/user/addresses/[id] error:", error);

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
          message: "Failed to update address",
        },
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/addresses/[id]
 * Delete an address
 */
export async function DELETE(
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
    await addressesService.delete(id, session.user.id);

    return NextResponse.json({
      success: true,
      message: "Address deleted successfully",
    });
  } catch (error) {
    console.error("[API] DELETE /api/user/addresses/[id] error:", error);

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
          message: "Failed to delete address",
        },
      },
      { status: 500 }
    );
  }
}
