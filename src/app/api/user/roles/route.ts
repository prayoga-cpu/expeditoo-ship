import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import * as userService from "@/server/services/user.service";
import { UserRolesResponseSchema } from "@/server/dto/user-roles.dto";

/**
 * GET /api/user/roles
 * Fetch roles for the currently authenticated user
 */
export async function GET(req: NextRequest) {
  try {
    // Get session from Better Auth
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    // Check if user is authenticated
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Unauthorized" },
        },
        { status: 401 }
      );
    }

    // Fetch user roles from database
    const roles = await userService.getUserRoles(session.user.id);

    // Validate response with DTO
    const response = UserRolesResponseSchema.parse({ roles });

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    console.error("[API] GET /api/user/roles error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" },
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/roles
 * Assign role to user (Admin only)
 */
export async function POST(req: NextRequest) {
  try {
    // Get session
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

    // Parse request body
    const body = await req.json();

    // Assign role (service will verify admin permission)
    const result = await userService.assignRole(body, session.user.id);

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    console.error("[API] POST /api/user/roles error:", error);

    const message = error instanceof Error ? error.message : "";

    if (message.includes("Unauthorized")) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message },
        },
        { status: 403 }
      );
    }

    if (message.includes("validation") || (error as { name?: string }).name === "ZodError") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: message,
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
          message: message || "Failed to assign role",
        },
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/roles
 * Remove role from user (Admin only)
 */
export async function DELETE(req: NextRequest) {
  try {
    // Get session
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

    // Parse request body
    const body = await req.json();

    // Remove role (service will verify admin permission)
    const result = await userService.removeRole(body, session.user.id);

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    console.error("[API] DELETE /api/user/roles error:", error);

    const message = error instanceof Error ? error.message : "";

    if (message.includes("Unauthorized")) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message },
        },
        { status: 403 }
      );
    }

    if (message.includes("validation") || (error as { name?: string }).name === "ZodError") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: message,
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
          message: message || "Failed to remove role",
        },
      },
      { status: 500 }
    );
  }
}
