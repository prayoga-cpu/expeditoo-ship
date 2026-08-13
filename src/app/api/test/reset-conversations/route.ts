import { auth } from "@/lib/auth";
import { db } from "@/db";
import { conversations, conversationParticipants, messages } from "@/db/schema/messages";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";

/**
 * DEV ONLY: Delete all conversations for current user
 */
export async function DELETE(_req: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const currentUserId = session.user.id;

    // Get all conversation IDs for this user
    const participations = await db.query.conversationParticipants.findMany({
      where: eq(conversationParticipants.userId, currentUserId),
      columns: { conversationId: true },
    });

    if (participations.length === 0) {
      return NextResponse.json({ success: true, message: "No conversations to delete" });
    }

    const conversationIds = participations.map(p => p.conversationId);

    // Delete in correct order to avoid FK constraints:
    // 1. Delete messages first
    await db.delete(messages).where(inArray(messages.conversationId, conversationIds));

    // 2. Delete participants
    await db.delete(conversationParticipants).where(inArray(conversationParticipants.conversationId, conversationIds));

    // 3. Delete conversations
    await db.delete(conversations).where(inArray(conversations.id, conversationIds));

    return NextResponse.json({
      success: true,
      message: `Deleted ${conversationIds.length} conversations`,
    });
  } catch (error) {
    console.error("Reset error:", error);
    return NextResponse.json({ success: false, error: "Internal Error" }, { status: 500 });
  }
}

