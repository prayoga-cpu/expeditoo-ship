import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  ablyService,
  AblyConfigurationError,
} from "@/server/services/ably.service";

/**
 * GET /api/ably/auth
 *
 * Generates a secure Ably TokenRequest for client-side real-time connections.
 * Uses Token Authentication to ensure API key is never exposed to client.
 *
 * @see docs/plans/plan_ably_integration.md
 * @see docs/api.md Section 10
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Get authenticated user
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required to access real-time features",
          },
        },
        { status: 401 }
      );
    }

    // 2. Check if Ably is configured
    if (!ablyService.isConfigured()) {
      console.error("[Ably Auth] ABLY_API_KEY not configured");
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CONFIGURATION_ERROR",
            message: "Real-time service is not configured",
          },
        },
        { status: 500 }
      );
    }

    // 3. Generate token request via service layer
    const tokenRequestData = await ablyService.createTokenRequest(
      session.user.id
    );

    // 4. Return standard success response
    return NextResponse.json({
      success: true,
      data: tokenRequestData,
    });
  } catch (error) {
    console.error("[Ably Auth] Error:", error);

    // Handle known errors
    if (error instanceof AblyConfigurationError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CONFIGURATION_ERROR",
            message: "Real-time service is not configured",
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ABLY_AUTH_ERROR",
          message: "Failed to generate real-time authentication token",
        },
      },
      { status: 500 }
    );
  }
}
