import { auth } from "@/lib/auth";
import { messagesService } from "@/server/services/messages.service";
import { getMessagesQuerySchema } from "@/server/dto/messages.dto";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const query = {
      page: Number(searchParams.get("page") || 1),
      limit: Number(searchParams.get("limit") || 50),
    };

    const validated = getMessagesQuerySchema.parse(query);
    const result = await messagesService.getThread(
      session.user.id,
      id,
      validated
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Get thread error:", error);
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

/**
 * DELETE /api/messages/conversations/[id]
 * Soft delete a conversation (Telegram-like behavior)
 * - Hides conversation from user's inbox
 * - Clears message history for the user
 * - Other participant still sees the conversation
 * - When new message arrives, conversation reappears but old history stays hidden
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const result = await messagesService.deleteConversation(
      session.user.id,
      id
    );

    return NextResponse.json({
      success: true,
      data: { deleted: result },
    });
  } catch (error) {
    console.error("Delete conversation error:", error);

    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("not found") ? 404 :
      message.includes("Not authorized") ? 403 : 500;

    return NextResponse.json(
      {
        success: false,
        error: {
          code: status === 404 ? "NOT_FOUND" :
            status === 403 ? "FORBIDDEN" : "INTERNAL_SERVER_ERROR",
          message,
        },
      },
      { status }
    );
  }
}
