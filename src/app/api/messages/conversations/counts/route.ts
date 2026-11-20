import { auth } from "@/lib/auth";
import { messagesService } from "@/server/services/messages.service";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

/**
 * How many of the caller's conversations each Messages filter holds
 * (client feedback 2026-11-19, #26). Takes no parameter: the only subject is
 * the session's own inbox.
 */
export async function GET() {
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

    const counts = await messagesService.getInboxCounts(session.user.id);

    return NextResponse.json({ success: true, data: counts });
  } catch (error) {
    console.error("Get inbox counts error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" },
      },
      { status: 500 }
    );
  }
}
