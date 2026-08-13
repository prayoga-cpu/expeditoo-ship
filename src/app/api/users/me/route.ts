import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import * as userService from "@/server/services/user.service";

/**
 * GET /api/users/me
 * Get current user profile (per API spec)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Unauthorized" },
        },
        { status: 401 }
      );
    }

    const profile = await userService.getProfile(session.user.id);

    return NextResponse.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    console.error("[API] GET /api/users/me error:", error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Failed to get profile",
        },
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/users/me
 * Update current user profile (per API spec)
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Unauthorized" },
        },
        { status: 401 }
      );
    }

    const body = await req.json();
    const updatedProfile = await userService.updateProfile(
      session.user.id,
      body
    );

    return NextResponse.json({
      success: true,
      data: updatedProfile,
    });
  } catch (error) {
    console.error("[API] PATCH /api/users/me error:", error);

    if (
      (error instanceof Error && error.message?.includes("validation")) ||
      (error as { name?: string }).name === "ZodError"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: error instanceof Error ? error.message : undefined,
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to update profile",
        },
      },
      { status: 500 }
    );
  }
}
