import { auth } from "@/lib/auth";
import { notificationsService } from "@/server/services/notifications.service";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(_request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
        },
        { status: 401 }
      );
    }

    const updatedCount = await notificationsService.markAllAsRead(
      session.user.id
    );

    return NextResponse.json({
      success: true,
      data: { updatedCount },
      message: "All notifications marked as read",
    });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to mark all notifications as read",
        },
      },
      { status: 500 }
    );
  }
}
