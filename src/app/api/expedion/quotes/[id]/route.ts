/**
 * ============================================================================
 * API: Expedion quotes — single
 * ============================================================================
 *
 * GET   /api/expedion/quotes/:id   Read one devis (owner or admin)
 * PATCH /api/expedion/quotes/:id   Client edits, incl. the confirm-details step
 */

import { NextRequest, NextResponse } from "next/server";
import { requireExpedionCaller } from "@/lib/expedion-auth";
import { expedionErrorResponse } from "@/lib/expedion-response";
import { updateExpedionQuoteSchema } from "@/server/dto/expedion.dto";
import { expedionService } from "@/server/services/expedion.service";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = requireExpedionCaller(req);
    const { id } = await params;
    const quote = await expedionService.getQuote(id, caller);
    return NextResponse.json({ success: true, data: quote });
  } catch (error) {
    return expedionErrorResponse(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = requireExpedionCaller(req);
    const { id } = await params;
    const input = updateExpedionQuoteSchema.parse(await req.json());
    const quote = await expedionService.updateQuote(id, caller, input);
    return NextResponse.json({ success: true, data: quote });
  } catch (error) {
    return expedionErrorResponse(error);
  }
}
