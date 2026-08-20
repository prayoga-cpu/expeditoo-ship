/**
 * POST /api/expedion/quotes/:id/estimate
 *
 * The client-facing counterpart to /suggest-price: while a quote is still
 * `pending`, hands back the same kind of AI price analysis an admin sees in
 * the reprice dialog, cached on first call. Additive — /suggest-price and
 * RepriceDialog are untouched.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireExpedionCaller } from "@/lib/expedion-auth";
import { expedionErrorResponse } from "@/lib/expedion-response";
import { expedionService } from "@/server/services/expedion.service";

export const dynamic = "force-dynamic";
// Vision over a bordereau plus lot photos is not fast.
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireExpedionCaller(req);
    const { id } = await params;
    const suggestion = await expedionService.getPriceSuggestion(id, caller);
    return NextResponse.json({ success: true, data: suggestion });
  } catch (error) {
    return expedionErrorResponse(error);
  }
}
