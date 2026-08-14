/**
 * POST /api/expedion/quotes/:id/accept
 *
 * The client picks one of the two prices on the devis — standard, or standard
 * plus ad valorem insurance — which moves the quote to `accepted` and fixes
 * `acceptedPriceCents` for checkout.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireExpedionCaller } from "@/lib/expedion-auth";
import { expedionErrorResponse } from "@/lib/expedion-response";
import { acceptExpedionQuoteSchema } from "@/server/dto/expedion.dto";
import { expedionService } from "@/server/services/expedion.service";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireExpedionCaller(req);
    const { id } = await params;
    const input = acceptExpedionQuoteSchema.parse(await req.json());
    const quote = await expedionService.acceptQuote(id, caller, input);
    return NextResponse.json({ success: true, data: quote });
  } catch (error) {
    return expedionErrorResponse(error);
  }
}
