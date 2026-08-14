/**
 * PATCH /api/expedion/quotes/:id/admin
 *
 * Admin operations on a devis: adjust the price, assign a driver from the
 * shared pool, move the status, or set the gardiennage countdown.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireExpedionAdmin } from "@/lib/expedion-auth";
import { expedionErrorResponse } from "@/lib/expedion-response";
import { adminUpdateExpedionQuoteSchema } from "@/server/dto/expedion.dto";
import { expedionService } from "@/server/services/expedion.service";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireExpedionAdmin(req);
    const { id } = await params;
    const input = adminUpdateExpedionQuoteSchema.parse(await req.json());
    const quote = await expedionService.adminUpdate(id, input);
    return NextResponse.json({ success: true, data: quote });
  } catch (error) {
    return expedionErrorResponse(error);
  }
}
