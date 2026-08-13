import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { account } from "@/db/schema/users";
import { eq } from "drizzle-orm";

/**
 * GET /api/users/me/provider
 * Check if user has OAuth provider (Google SSO)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
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

    // Get user's accounts to check provider
    const accounts = await db
      .select({ providerId: account.providerId, password: account.password })
      .from(account)
      .where(eq(account.userId, session.user.id));

    // Check if user has a password set on any account (more robust than checking providerId string)
    const hasPassword = accounts.some((acc) => !!acc.password);

    // If they have a password, they can manage their profile.
    // Restricted only if they have NO password (pure OAuth/Magic Link without password)
    const isRestrictedOAuth = !hasPassword;

    const oauthProvider = accounts.find(
      (acc) => acc.providerId !== "credential"
    )?.providerId;

    return NextResponse.json({
      success: true,
      data: {
        isOAuth: isRestrictedOAuth,
        provider: oauthProvider || null,
      },
    });
  } catch (error) {
    console.error("[API] GET /api/users/me/provider error:", error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Failed to get provider",
        },
      },
      { status: 500 }
    );
  }
}
