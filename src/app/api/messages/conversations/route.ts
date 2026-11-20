import { auth } from "@/lib/auth";
import { messagesService } from "@/server/services/messages.service";
import { getConversationsQuerySchema } from "@/server/dto/messages.dto";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
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

    const { searchParams } = new URL(req.url);
    const query = {
      page: Number(searchParams.get("page") || 1),
      limit: Number(searchParams.get("limit") || 20),
      search: searchParams.get("search") || undefined,
      // The state of the job (conversation-filter.ts); absent means all.
      filter: searchParams.get("filter") || undefined,
    };

    // A filter the chips do not offer is the caller's mistake, said as one:
    // `parse` threw into the catch below and answered 500.
    const parsed = getConversationsQuerySchema.safeParse(query);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid query" },
        },
        { status: 400 }
      );
    }
    const result = await messagesService.getInbox(session.user.id, parsed.data);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Get inbox error:", error);
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
