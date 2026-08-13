import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { messagesDAL } from "@/server/dal/messages.dal";

/**
 * POST /api/conversations/:id/read
 * Lightweight endpoint to mark a conversation as read
 * Used by real-time chat to mark messages as read without refetching all data
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { id: conversationId } = await params;
    
    // Mark conversation as read
    await messagesDAL.markAsRead(conversationId, session.user.id);

    return NextResponse.json({ 
      success: true, 
      data: { marked: true } 
    });
  } catch (error) {
    console.error("[API] Error marking conversation as read:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to mark as read" } },
      { status: 500 }
    );
  }
}
