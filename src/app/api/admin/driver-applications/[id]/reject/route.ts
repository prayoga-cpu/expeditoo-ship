import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { driverService } from "@/server/services/driver.service";
import { db } from "@/db";

// Helper to check admin role
async function isAdmin(userId: string) {
    const role = await db.query.userRoles.findFirst({
        where: (roles, { and, eq }) =>
            and(eq(roles.userId, userId), eq(roles.role, "admin")),
    });
    return !!role;
}

export async function POST(
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

        const updatedApplication = await driverService.updateApplicationStatus(
            id,
            { status: "REJECTED" }
        );

        return NextResponse.json({
            success: true,
            data: updatedApplication,
        });
    } catch (error) {
        console.error("[Admin Driver Reject] Error:", error);
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
