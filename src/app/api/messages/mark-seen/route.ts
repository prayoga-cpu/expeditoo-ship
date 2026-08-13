import { auth } from "@/lib/auth";
import { messagesService } from "@/server/services/messages.service";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

/**
 * POST /api/messages/mark-seen
 * Marks all user's conversations as "seen" (updates lastReadAt).
 * Called when user visits the messages page.
 * This clears the unread message count from the notification bell.
 */
export async function POST() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const updatedCount = await messagesService.markAllAsSeen(session.user.id);

    return NextResponse.json({
      success: true,
      data: { updatedCount },
    });
  } catch (error) {
    console.error("Mark seen error:", error);
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
