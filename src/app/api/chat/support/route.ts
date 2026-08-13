import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { conversations, conversationParticipants } from "@/db/schema/messages";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

/**
 * POST /api/chat/support
 * Create or get existing support chat for current user
 */
export async function POST(_req: NextRequest) {
    try {
        // Get current user session
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session?.user) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: "UNAUTHORIZED",
                        message: "Unauthorized"
                    }
                },
                { status: 401 }
            );
        }

        const userId = session.user.id;

        // Check if user already has a support chat
        const existingChat = await db.query.conversationParticipants.findFirst({
            where: and(
                eq(conversationParticipants.userId, userId)
            ),
            with: {
                conversation: true,
            },
        });

        // Filter for support chat type
        const supportChat = existingChat?.conversation.type === "SUPPORT"
            ? existingChat
            : null;

        if (supportChat) {
            return NextResponse.json({
                success: true,
                data: {
                    chatRoomId: supportChat.conversationId,
                    exists: true,
                }
            });
        }

        // Create new support chat
        const chatRoomId = nanoid();
        const participantId = nanoid();

        // Create conversation
        await db.insert(conversations).values({
            id: chatRoomId,
            type: "SUPPORT",
            listingId: null, // No listing for support chats
            lastMessageAt: null,
        });

        // Add user as participant
        await db.insert(conversationParticipants).values({
            id: participantId,
            conversationId: chatRoomId,
            userId: userId,
        });

        return NextResponse.json({
            success: true,
            data: {
                chatRoomId,
                exists: false,
            }
        });
    } catch (error) {
        console.error("Error creating support chat:", error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Failed to create support chat"
                }
            },
            { status: 500 }
        );
    }
}
