import { auth } from "@/lib/auth";
import { db } from "@/db";
import { notifications } from "@/db/schema/notifications";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";

/**
 * DELETE /api/notifications/[id] - Delete a specific notification
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id: notificationId } = await params;
    const userId = session.user.id;

    // Verify ownership and delete
    await db.delete(notifications).where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId)
      )
    );

    return NextResponse.json({
      success: true,
      message: "Notification deleted",
    });
  } catch (error) {
    console.error("Delete notification error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Error" },
      { status: 500 }
    );
  }
}
