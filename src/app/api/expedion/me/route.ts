/**
 * ============================================================================
 * API: Expedion caller identity
 * ============================================================================
 *
 * GET /api/expedion/me   Who the presented credential resolves to.
 *
 * The Flutter app needs one thing it cannot work out for itself: whether the
 * signed-in person is an operator. "Admin" lives in `user_roles` on this side,
 * and the client has no view of that table — so without this it would either
 * show the admin entry point to everybody and let the redirect sort it out, or
 * hide it from the operators who need it.
 *
 * Deliberately thin. It reports the decision `requireExpedionCaller` already
 * made and grants nothing: an attacker who forged `isAdmin: true` in a response
 * would move a link in their own UI and still be refused by every guarded
 * route, because each one re-derives the role server-side.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireExpedionCaller } from "@/lib/expedion-auth";
import { expedionErrorResponse } from "@/lib/expedion-response";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const caller = await requireExpedionCaller(req);
    return NextResponse.json({
      success: true,
      data: {
        userId: caller.userId,
        isAdmin: caller.isAdmin,
        // Which credential answered — a session, a Firebase ID token or a
        // shared key. Surfaced so a client stuck on the wrong one is
        // diagnosable without server logs.
        via: caller.via,
      },
    });
  } catch (error) {
    return expedionErrorResponse(error);
  }
}
