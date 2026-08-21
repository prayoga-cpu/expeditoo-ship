import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { conversations, messages } from "@/db/schema/messages";
import { hasAnyRole } from "@/server/services/user.service";

import { eq, and, desc, gt, sql } from "drizzle-orm";

/**
 * GET /api/admin/support-chats
 * Get all support chats for admin dashboard
 */
export async function GET(req: NextRequest) {
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

        // Every support conversation on the platform, across every user —
        // being signed in is not being staff. `support` is this feature's own
        // role (docs/specs/roles_spec.md: "act in support conversations");
        // `admin` always has it too.
        const authorized = await hasAnyRole(session.user.id, ["admin", "support"]);
        if (!authorized) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: "FORBIDDEN",
                        message: "Admin or support access required"
                    }
                },
                { status: 403 }
            );
        }

        // Get query params
        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status") || "all"; // all | unread

        // Fetch all support conversations using db.query for safer relation handling
        const chats = await db.query.conversations.findMany({
            where: eq(conversations.type, "SUPPORT"),
            with: {
                participants: {
                    with: {
                        user: true
                    }
                }
            },
            orderBy: desc(conversations.lastMessageAt)
        });

        // Enrich chats with details
        const enrichedChats = await Promise.all(
            chats.map(async (chat) => {
                // Find criteria:
                // We want to show the User who is NOT the current admin.
                // If the chat only has the user (no admin joined yet), simple.
                // If the chat has User + Admin, we want to show User.
                const participants = chat.participants;

                let targetParticipant = participants.find(p => p.userId !== session.user.id);
                // Fallback: if I am the only participant (?) or somehow filtered out everyone
                if (!targetParticipant && participants.length > 0) {
                    targetParticipant = participants[0];
                }

                if (!targetParticipant) {
                    // Chat has no participants? Skip it.
                    return null;
                }

                // Get last message
                const lastMessage = await db.query.messages.findFirst({
                    where: eq(messages.conversationId, chat.id),
                    orderBy: desc(messages.createdAt),
                });

                // Calculate unread count for the CURRENT USER (Admin)
                // We need the admin's 'lastReadAt'
                const myParticipant = participants.find(p => p.userId === session.user.id);
                let unreadCount = 0;

                if (myParticipant) {
                    // `gt`, not an interpolated `sql` template: a JS Date
                    // dropped into a raw fragment reaches the pg driver as a
                    // bind parameter it refuses ("Received an instance of
                    // Date"), and the whole listing 500s. It only bit once an
                    // admin had joined a thread *and* read it — which is to
                    // say, from the second visit to this page onward.
                    const countResult = await db
                        .select({ count: sql<number>`count(*)` })
                        .from(messages)
                        .where(
                            and(
                                eq(messages.conversationId, chat.id),
                                myParticipant.lastReadAt
                                    ? gt(messages.createdAt, myParticipant.lastReadAt)
                                    : undefined
                            )
                        );
                    unreadCount = Number(countResult[0]?.count || 0);
                } else {
                    // Admin is not a participant yet.
                    // Show total messages as unread? Or 0?
                    // Typically if admin hasn't joined, they haven't read anything.
                    // But maybe we count all messages?
                    // Let's count all messages for now to alert them.
                    const countResult = await db
                        .select({ count: sql<number>`count(*)` })
                        .from(messages)
                        .where(eq(messages.conversationId, chat.id));
                    unreadCount = Number(countResult[0]?.count || 0);
                }

                return {
                    conversationId: chat.id,
                    type: chat.type,
                    user: {
                        id: targetParticipant.user.id,
                        name: targetParticipant.user.name,
                        email: targetParticipant.user.email,
                        image: targetParticipant.user.image,
                    },
                    lastMessage: lastMessage
                        ? {
                            content: lastMessage.content,
                            createdAt: lastMessage.createdAt,
                            senderId: lastMessage.senderId,
                        }
                        : null,
                    unreadCount,
                    lastMessageAt: chat.lastMessageAt,
                    createdAt: chat.createdAt,
                };
            })
        );

        // Filter nulls and sort (already sorted by lastMessageAt but enrichment keeps order? Yes Promise.all keeps order)
        const validChats = enrichedChats.filter((c): c is NonNullable<typeof c> => c !== null);

        // Filter by status if needed
        const filteredChats =
            status === "unread"
                ? validChats.filter((chat) => chat.unreadCount > 0)
                : validChats;

        return NextResponse.json({
            success: true,
            data: {
                chats: filteredChats,
                total: filteredChats.length,
            }
        });
    } catch (error) {
        console.error("Error fetching support chats:", error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Failed to fetch support chats"
                }
            },
            { status: 500 }
        );
    }
}
