/**
 * GET /api/expedion/quotes/:id/events
 *
 * The shared status feed behind Expedion's tracking screen. Both apps append
 * to it, so neither has to ask the other what happened.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireExpedionCaller } from "@/lib/expedion-auth";
import { expedionErrorResponse } from "@/lib/expedion-response";
import { expedionService } from "@/server/services/expedion.service";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireExpedionCaller(req);
    const { id } = await params;
    const events = await expedionService.listEvents(id, caller);
    return NextResponse.json({ success: true, data: events });
  } catch (error) {
    return expedionErrorResponse(error);
  }
}
