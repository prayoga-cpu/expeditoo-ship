import { auth } from "@/lib/auth";
import { db } from "@/db";
import { user } from "@/db/schema/users";
import { conversations, conversationParticipants, messages } from "@/db/schema/messages";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { eq, ne } from "drizzle-orm";

/**
 * DEV ONLY: Seed conversations with all other users
 */
export async function POST(_req: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const currentUserId = session.user.id;

    // 1. Get all other users
    const otherUsers = await db.query.user.findMany({
      where: ne(user.id, currentUserId),
      limit: 5, // Limit to 5 users for testing
    });

    if (otherUsers.length === 0) {
      return NextResponse.json({ success: false, message: "No other users found" });
    }

    // 2. Get existing conversations for current user
    const existingParticipations = await db.query.conversationParticipants.findMany({
      where: eq(conversationParticipants.userId, currentUserId),
      with: {
        conversation: {
          with: {
            participants: true,
          },
        },
      },
    });

    // Extract user IDs that already have a conversation with current user
    const existingChatPartners = new Set<string>();
    for (const participation of existingParticipations) {
      for (const p of participation.conversation.participants) {
        if (p.userId !== currentUserId) {
          existingChatPartners.add(p.userId);
        }
      }
    }

    let createdCount = 0;

    for (const targetUser of otherUsers) {
      // Skip if conversation already exists with this user
      if (existingChatPartners.has(targetUser.id)) {
        continue;
      }

      const convId = nanoid();

      // Create Conversation
      await db.insert(conversations).values({
        id: convId,
        createdAt: new Date(),
        lastMessageAt: new Date(),
      });

      // Add Participants
      await db.insert(conversationParticipants).values([
        {
          id: nanoid(),
          conversationId: convId,
          userId: currentUserId,
          joinedAt: new Date(),
          lastReadAt: new Date(),
        },
        {
          id: nanoid(),
          conversationId: convId,
          userId: targetUser.id,
          joinedAt: new Date(),
        }
      ]);

      // Add Welcome Message
      await db.insert(messages).values({
        id: nanoid(),
        conversationId: convId,
        senderId: currentUserId,
        content: `Hi ${targetUser.name}, let's test chat!`,
        createdAt: new Date(),
      });

      createdCount++;
    }

    return NextResponse.json({
      success: true,
      message: createdCount > 0
        ? `Created ${createdCount} new conversations`
        : "All users already have conversations",
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json({ success: false, error: "Internal Error" }, { status: 500 });
  }
}
