/**
 * GET /api/expedion/quotes/:id/photos
 *
 * The Expedion client's half of shipment_photos_spec.md §7.3.
 *
 * An escalated job belongs to the Expedion system account, so its client is a
 * quote owner with no `user` row and no seat as a party to the shipment. That
 * makes `GET /api/shipments/:id/photos` — which authorises on the parties —
 * structurally unable to reach them, which is why this route exists rather
 * than the Flutter app calling the other one with a different token.
 *
 * Authorisation is `getQuote`'s: owner or admin, and a non-owner gets the same
 * 404 a missing quote gets so the two cannot be told apart.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireExpedionCaller } from "@/lib/expedion-auth";
import { expedionErrorResponse } from "@/lib/expedion-response";
import { expedionService } from "@/server/services/expedion.service";
import { shipmentPhotosService } from "@/server/services/shipment-photos.service";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireExpedionCaller(req);
    const { id } = await params;
    const quote = await expedionService.getQuote(id, caller);

    /*
     * Two empty arrays rather than a 404 when the quote has not been escalated
     * yet. "Nothing has been photographed" is a normal state on a tracking
     * screen — the run may not even have a driver — and an error there would
     * have the client's app showing a failure for a job progressing fine.
     */
    if (!quote.listingId) {
      return NextResponse.json({
        success: true,
        data: { pickup: [], delivery: [] },
      });
    }

    const photos = await shipmentPhotosService.listForListing(
      quote.listingId,
      (photo) => `/api/expedion/quotes/${id}/photos/${photo.id}`
    );

    return NextResponse.json({ success: true, data: photos });
  } catch (error) {
    return expedionErrorResponse(error);
  }
}
