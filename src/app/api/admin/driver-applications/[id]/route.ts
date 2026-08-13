import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { driverService } from "@/server/services/driver.service";
import { updateDriverApplicationStatusSchema } from "@/server/dto/driver.dto";
import { db } from "@/db";
import { z } from "zod";

// Helper to check admin role
async function isAdmin(userId: string) {
  const role = await db.query.userRoles.findFirst({
    where: (roles, { and, eq }) =>
      and(eq(roles.userId, userId), eq(roles.role, "admin")),
  });
  return !!role;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const isUserAdmin = await isAdmin(session.user.id);
    if (!isUserAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "Forbidden" },
        },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const validatedData = updateDriverApplicationStatusSchema.parse(body);

    const updatedApplication = await driverService.updateApplicationStatus(
      id,
      validatedData
    );

    return NextResponse.json({
      success: true,
      data: updatedApplication,
    });
  } catch (error) {
    console.error("[Admin Driver Application PATCH] Error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request data",
            details: error.errors,
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Internal Server Error",
        },
      },
      { status: 500 }
    );
  }
}

