import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { z } from "zod";
import { messagesDAL } from "@/server/dal/messages.dal";
import { nanoid } from "nanoid";

const initConversationSchema = z.object({
  recipientId: z.string(),
  listingId: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Unauthorized" },
        },
        { status: 401 }
      );
    }

    const body = await req.json();
    const validation = initConversationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request data",
            details: validation.error.format(),
          },
        },
        { status: 400 }
      );
    }

    const { recipientId, listingId } = validation.data;

    // Prevent talking to self
    if (recipientId === session.user.id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_RECIPIENT",
            message: "Cannot message yourself",
          },
        },
        { status: 400 }
      );
    }

    // 1. Try to find existing conversation
    const existingConv = await messagesDAL.findConversation(
      session.user.id,
      recipientId,
      listingId
    );

    if (existingConv) {
      return NextResponse.json({
        success: true,
        data: { conversationId: existingConv.id, isNew: false },
      });
    }

    // 2. Create new conversation
    const newConv = await messagesDAL.createConversation(
      {
        id: nanoid(),
        listingId: listingId || null,
        lastMessageAt: new Date(), // Set explicitly or let default handle (usually helps sorting)
        updatedAt: new Date(),
      },
      [session.user.id, recipientId]
    );

    return NextResponse.json(
      {
        success: true,
        data: { conversationId: newConv.id, isNew: true },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Init conversation error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Internal server error",
        },
      },
      { status: 500 }
    );
  }
}
