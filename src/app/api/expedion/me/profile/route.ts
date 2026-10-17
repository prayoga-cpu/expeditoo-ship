/**
 * ============================================================================
 * API: the Expedion client's own profile
 * ============================================================================
 *
 * GET /api/expedion/me/profile   names, phone, postal address
 * PUT /api/expedion/me/profile   the same, every key optional
 *
 * Replaces the Airtable USERS table the Flutter app wrote at sign-up and read
 * on its personal space (launch_readiness_spec.md §C). Session callers only:
 * a shared key or a Firebase token answers 403 PROFILE_NEEDS_ACCOUNT.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireExpedionCaller } from "@/lib/expedion-auth";
import { expedionErrorResponse } from "@/lib/expedion-response";
import { expedionProfileService } from "@/server/services/expedion-profile.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const caller = await requireExpedionCaller(req);
    const data = await expedionProfileService.get(caller);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return expedionErrorResponse(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const caller = await requireExpedionCaller(req);
    const body = await req.json();
    const data = await expedionProfileService.update(caller, body);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return expedionErrorResponse(error);
  }
}
