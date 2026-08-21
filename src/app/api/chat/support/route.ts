import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { messagesService } from "@/server/services/messages.service";

/**
 * POST /api/chat/support
 * Create or get existing support chat for current user
 *
 * The lookup lives in `messagesService.getOrCreateSupportConversation`, shared
 * with the Expedion bridge (`/api/expedion/support`) so both products write to
 * one thread per person. It also fixes what this route used to do: it read the
 * user's *first* participant row and only accepted it if that conversation
 * happened to be a support one, so anybody who had ever messaged a carrier got
 * a brand-new support thread on every visit.
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

        const { conversationId, created } =
            await messagesService.getOrCreateSupportConversation(session.user.id);

        return NextResponse.json({
            success: true,
            data: {
                chatRoomId: conversationId,
                exists: !created,
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
