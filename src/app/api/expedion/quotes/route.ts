/**
 * ============================================================================
 * API: Expedion quotes — collection
 * ============================================================================
 *
 * GET  /api/expedion/quotes   List the caller's own quotes. `?scope=all`
 *                             widens to every owner and requires an admin.
 * POST /api/expedion/quotes   File a new devis from an uploaded bordereau
 *
 * Replaces the Airtable `CONTACTS` table the Flutter client reads today
 * (expedion_encheres ROADMAP.md §5, Phase A).
 */

import { NextRequest, NextResponse } from "next/server";
import {
  ExpedionAuthError,
  requireExpedionCaller,
} from "@/lib/expedion-auth";
import { expedionErrorResponse } from "@/lib/expedion-response";
import {
  createExpedionQuoteSchema,
  listExpedionQuotesSchema,
} from "@/server/dto/expedion.dto";
import { expedionService } from "@/server/services/expedion.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const caller = await requireExpedionCaller(req);
    const { searchParams } = new URL(req.url);

    const { scope, ...filters } = listExpedionQuotesSchema.parse({
      status: searchParams.get("status") ?? undefined,
      bordereauNumber: searchParams.get("bordereauNumber") ?? undefined,
      pickupCity: searchParams.get("pickupCity") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      scope: searchParams.get("scope") ?? undefined,
    });

    // Sweeping the table is an operator action and has to be asked for.
    // Refused rather than downgraded: a caller that asked for every row should
    // learn it cannot have them, not silently receive its own and believe it
    // saw everything.
    if (scope === "all" && !caller.isAdmin) {
      throw new ExpedionAuthError("FORBIDDEN", 403);
    }

    const { rows, total } = await expedionService.listQuotes({
      ...filters,
      owner:
        scope === "all"
          ? { scope: "all" }
          : { scope: "mine", ownerId: caller.userId },
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
    const caller = await requireExpedionCaller(req);
    const body = await req.json();
    const input = createExpedionQuoteSchema.parse(body);

    const quote = await expedionService.createQuote(caller.userId, input);

    return NextResponse.json({ success: true, data: quote }, { status: 201 });
  } catch (error) {
    return expedionErrorResponse(error);
  }
}
