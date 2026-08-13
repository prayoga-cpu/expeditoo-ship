import { auth } from "@/lib/auth";
import { messagesService } from "@/server/services/messages.service";
import { sendMessageSchema } from "@/server/dto/messages.dto";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function POST(req: Request) {
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

    const body = await req.json();
    const validated = sendMessageSchema.parse(body);

    // Pass sender info from session to avoid extra DB query
    const result = await messagesService.sendMessage(
      session.user.id, 
      validated,
      { name: session.user.name, image: session.user.image ?? null }
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Send message error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: error.errors,
          },
        },
        { status: 400 }
      );
    }
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
