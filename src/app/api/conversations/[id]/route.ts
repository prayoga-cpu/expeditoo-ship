import { auth } from "@/lib/auth";
import { db } from "@/db";
import { conversations, conversationParticipants, messages } from "@/db/schema/messages";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq, and, isNull } from "drizzle-orm";

/**
 * DELETE /api/conversations/[id] - Soft-delete a conversation for the current user
 * 
 * Logic:
 * 1. Set deletedAt for the current user's participant record
 * 2. Check if ALL participants have now deleted the conversation
 * 3. If yes → Hard delete (remove conversation + messages)
 * 4. If no → Keep data for remaining participants
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
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id: conversationId } = await params;
    const userId = session.user.id;

    // Verify user is participant
    const participation = await db.query.conversationParticipants.findFirst({
      where: and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId)
      ),
    });

    if (!participation) {
      return NextResponse.json(
        { success: false, error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Step 1: Soft delete - set deletedAt for current user
    // Also set lastClearedAt to now, so if they rejoin, they don't see old messages
    await db
      .update(conversationParticipants)
      .set({ 
        deletedAt: new Date(),
        lastClearedAt: new Date() 
      })
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, userId)
        )
      );

    // Step 2: Check if ALL participants have now deleted the conversation
    const remainingActiveParticipants = await db.query.conversationParticipants.findFirst({
      where: and(
        eq(conversationParticipants.conversationId, conversationId),
        // Find any participant that has NOT deleted (deletedAt is NULL)
        isNull(conversationParticipants.deletedAt)
      ),
    });

    // Step 3: If no active participants remain → Hard delete
    if (!remainingActiveParticipants) {
      // Delete in order: messages → participants → conversation
      await db.delete(messages).where(eq(messages.conversationId, conversationId));
      await db.delete(conversationParticipants).where(eq(conversationParticipants.conversationId, conversationId));
      await db.delete(conversations).where(eq(conversations.id, conversationId));

      return NextResponse.json({
        success: true,
        message: "Conversation permanently deleted (all participants removed)",
      });
    }

    // Step 4: Some participants still active → Keep data, just hide for current user
    return NextResponse.json({
      success: true,
      message: "Conversation hidden from your view",
    });
  } catch (error) {
    console.error("Delete conversation error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Error" },
      { status: 500 }
    );
  }
}
