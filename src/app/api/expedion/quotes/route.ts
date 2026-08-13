/**
 * ============================================================================
 * API: Expedion quotes — collection
 * ============================================================================
 *
 * GET  /api/expedion/quotes   List the caller's quotes (all quotes for admins)
 * POST /api/expedion/quotes   File a new devis from an uploaded bordereau
 *
 * Replaces the Airtable `CONTACTS` table the Flutter client reads today
 * (expedion_encheres ROADMAP.md §5, Phase A).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireExpedionCaller } from "@/lib/expedion-auth";
import { expedionErrorResponse } from "@/lib/expedion-response";
import {
  createExpedionQuoteSchema,
  listExpedionQuotesSchema,
} from "@/server/dto/expedion.dto";
import { expedionService } from "@/server/services/expedion.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const caller = requireExpedionCaller(req);
    const { searchParams } = new URL(req.url);

    const filters = listExpedionQuotesSchema.parse({
      status: searchParams.get("status") ?? undefined,
      bordereauNumber: searchParams.get("bordereauNumber") ?? undefined,
      pickupCity: searchParams.get("pickupCity") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    const { rows, total } = await expedionService.listQuotes({
      ...filters,
      // Admins may sweep the whole table; everyone else sees only their own.
      firebaseUid: caller.isAdmin ? undefined : caller.firebaseUid,
    });

    return NextResponse.json({
      success: true,
      data: rows,
      meta: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
      },
    });
  } catch (error) {
    return expedionErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = requireExpedionCaller(req);
    const body = await req.json();
    const input = createExpedionQuoteSchema.parse(body);

    const quote = await expedionService.createQuote(caller.firebaseUid, input);

    return NextResponse.json({ success: true, data: quote }, { status: 201 });
  } catch (error) {
    return expedionErrorResponse(error);
  }
}
