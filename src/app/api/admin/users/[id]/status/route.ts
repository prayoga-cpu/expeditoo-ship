import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { updateUserStatus } from "@/server/services/admin.service";
import { hasRole } from "@/server/services/user.service";
import { updateUserStatusInputSchema } from "@/server/dto/admin.dto";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const { id: userId } = await params;

    // Check authentication
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        },
        { status: 401 }
      );
    }

    // Check admin role
    const isAdmin = await hasRole(session.user.id, "admin");
    if (!isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "Admin access required" },
        },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const validation = updateUserStatusInputSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request body",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { banned } = validation.data;

    // Update user status via service
    const updatedUser = await updateUserStatus(userId, banned, session.user.id);

    return NextResponse.json({
      success: true,
      data: updatedUser,
      message: banned ? "User has been suspended" : "User has been activated",
    });
  } catch (error: unknown) {
    console.error("Error updating user status:", error);

    // Handle specific errors
    if (error instanceof Error) {
      if (error.message === "SELF_BAN_NOT_ALLOWED") {
        return NextResponse.json(
          {
            success: false,
            error: { code: "BAD_REQUEST", message: "Cannot ban yourself" },
          },
          { status: 400 }
        );
      }

      if (error.message === "USER_NOT_FOUND") {
        return NextResponse.json(
          {
            success: false,
            error: { code: "NOT_FOUND", message: "User not found" },
          },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Internal server error",
        },
      },
      { status: 500 }
    );
  }
}
