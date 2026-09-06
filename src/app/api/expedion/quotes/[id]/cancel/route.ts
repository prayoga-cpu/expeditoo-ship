/**
 * POST /api/expedion/quotes/:id/cancel
 *
 * The requester's half of the feature on the escalated inlet.
 *
 * That client is the one person "cancellations from both sides" could not reach
 * any other way: they own the transport, they paid for it, and they have no
 * `user` row in this app at all — so `partyFor` cannot resolve them and
 * `/api/shipments/:id/cancel` is closed to them.
 *
 * Addressed by quote id because that is the only identifier the Flutter client
 * holds, and authorised the way this inlet already authorises `/confirm`:
 * through `expedionService.getQuote`, which answers **404** rather than 403 to a
 * non-owner. That is deliberate over there and is preserved here, or this route
 * becomes a quote-id oracle standing beside routes that are not.
 *
 * See docs/specs/cancellations_spec.md §1.1.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireExpedionCaller } from "@/lib/expedion-auth";
import { expedionErrorResponse } from "@/lib/expedion-response";
import { cancelJobSchema } from "@/server/dto/cancellation.dto";
import { shipmentCancellationService } from "@/server/services/shipment-cancellation.service";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireExpedionCaller(req);
    const { id } = await params;
    const input = cancelJobSchema.parse(await req.json());

    return NextResponse.json({
      success: true,
      data: await shipmentCancellationService.cancelForQuote(id, caller, input),
    });
  } catch (error) {
    return expedionErrorResponse(error);
  }
}
