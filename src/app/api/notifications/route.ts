import { auth } from "@/lib/auth";
import { GetNotificationsQuerySchema } from "@/server/dto/notifications.dto";
import { notificationsService } from "@/server/services/notifications.service";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = {
      limit: searchParams.get("limit"),
      offset: searchParams.get("offset"),
      filter: searchParams.get("filter"),
    };

    const validatedQuery = GetNotificationsQuerySchema.parse(query);

    const result = await notificationsService.getUserNotifications(
      session.user.id,
      validatedQuery
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch notifications",
        },
      },
      { status: 500 }
    );
  }
}
