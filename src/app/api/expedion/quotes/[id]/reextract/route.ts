/**
 * POST /api/expedion/quotes/:id/reextract
 *
 * Re-reads the bordereau already stored on a quote and writes back whatever
 * the model finds — client identity, pickup, the lot. For an admin helping a
 * client who uploaded a document but never finished the confirm-details
 * step. Same extraction the client's own upload flow uses; this just points
 * it at the stored document instead of a fresh upload.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireExpedionAdmin } from "@/lib/expedion-auth";
import { expedionErrorResponse } from "@/lib/expedion-response";
import { expedionService } from "@/server/services/expedion.service";
import { ExtractionUnavailableError } from "@/server/services/expedion-extraction.service";

export const dynamic = "force-dynamic";
// Vision over a bordereau is not fast.
export const maxDuration = 120;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireExpedionAdmin(req);
    const { id } = await params;
    const result = await expedionService.reextractDocument(id);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof ExtractionUnavailableError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: "Extraction indisponible pour le moment.",
          },
        },
        { status: error.status }
      );
    }
    return expedionErrorResponse(error);
  }
}
