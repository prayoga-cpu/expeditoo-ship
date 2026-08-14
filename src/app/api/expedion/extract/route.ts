/**
 * POST /api/expedion/extract
 *
 * Reads an uploaded bordereau (PDF or JPEG) and returns the extracted fields
 * for the confirm-details screen. Optionally writes them onto an existing
 * quote, which is the path the Flutter upload flow takes.
 *
 * The response always includes `missingFields` so the client can highlight
 * what the model could not find rather than silently presenting blanks.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireExpedionCaller } from "@/lib/expedion-auth";
import { expedionErrorResponse } from "@/lib/expedion-response";
import {
  expedionExtractionService,
  ExtractionUnavailableError,
} from "@/server/services/expedion-extraction.service";
import { expedionService } from "@/server/services/expedion.service";
import { expedionDal } from "@/server/dal/expedion.dal";

export const dynamic = "force-dynamic";
// Vision over a multi-page PDF is not fast.
export const maxDuration = 120;

const extractSchema = z.object({
  /** Base64 payload, with or without the `data:` prefix. */
  data: z.string().min(1),
  mimeType: z.string().min(1),
  filename: z.string().optional(),
  /** When set, the extraction is written onto this quote. */
  quoteId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const caller = await requireExpedionCaller(req);
    const input = extractSchema.parse(await req.json());

    const outcome = await expedionExtractionService.extract({
      data: input.data,
      mimeType: input.mimeType,
      filename: input.filename,
    });

    if (input.quoteId) {
      // Ownership check before writing anything.
      await expedionService.getQuote(input.quoteId, caller);

      const patch = expedionExtractionService.toQuotePatch(outcome.extraction);
      // Only overwrite columns the model actually filled, so a re-run never
      // blanks a field the client already corrected by hand.
      const nonNull = Object.fromEntries(
        Object.entries(patch).filter(([, v]) => v !== null && v !== undefined)
      );

      await expedionDal.update(input.quoteId, {
        ...nonNull,
        extraction: outcome.extraction,
        extractionModel: outcome.model,
        extractionConfidence: outcome.extraction.confidence,
        status: "awaiting_confirmation",
      });
    }

    return NextResponse.json({ success: true, data: outcome });
  } catch (error) {
    if (error instanceof ExtractionUnavailableError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message:
              "Extraction indisponible pour le moment. Saisissez les informations manuellement.",
          },
        },
        { status: error.status }
      );
    }
    return expedionErrorResponse(error);
  }
}
