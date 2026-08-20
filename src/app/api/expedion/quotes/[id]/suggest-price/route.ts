/**
 * POST /api/expedion/quotes/:id/suggest-price
 *
 * Reads a quote's bordereau and details and returns a suggested standard +
 * ad valorem price with the reasoning behind it. Nothing is written — the
 * operator still publishes through PATCH .../admin, same as a manually typed
 * price.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireExpedionAdmin } from "@/lib/expedion-auth";
import { expedionErrorResponse } from "@/lib/expedion-response";
import { expedionPriceSuggestionService } from "@/server/services/expedion-price-suggestion.service";

export const dynamic = "force-dynamic";
// Vision over a bordereau plus lot photos is not fast.
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireExpedionAdmin(req);
    const { id } = await params;
    const suggestion = await expedionPriceSuggestionService.suggest(id);
    return NextResponse.json({ success: true, data: suggestion });
  } catch (error) {
    return expedionErrorResponse(error);
  }
}
