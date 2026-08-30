/**
 * GET /api/expedion/quotes/:id/photos/:photoId
 *
 * One pickup or delivery photo, for the client who paid for the job.
 *
 * A 302 to a five-minute presigned URL, exactly as `/api/expedion/files/:id`
 * does: `Image.network` in Flutter follows the redirect, and the short life
 * means a link that escapes the app is worthless by the time it does.
 *
 * The photo is looked up through the quote's own listing, so a photo id from
 * someone else's job answers `PHOTO_NOT_FOUND` — being able to read one quote
 * grants nothing about any other.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireExpedionCaller } from "@/lib/expedion-auth";
import { expedionErrorResponse } from "@/lib/expedion-response";
import { ExpedionError } from "@/server/services/expedion.service";
import { expedionService } from "@/server/services/expedion.service";
import { shipmentPhotosService } from "@/server/services/shipment-photos.service";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  try {
    const caller = await requireExpedionCaller(req);
    const { id, photoId } = await params;
    const quote = await expedionService.getQuote(id, caller);

    if (!quote.listingId) {
      throw new ExpedionError("PHOTO_NOT_FOUND", 404, "Photo introuvable");
    }

    const url = await shipmentPhotosService.presignForListing(
      quote.listingId,
      photoId
    );

    return NextResponse.redirect(url, {
      status: 302,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return expedionErrorResponse(error);
  }
}
