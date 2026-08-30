/**
 * POST /api/expedion/quotes/:id/confirm
 *
 * The client attests that a milestone the transporter recorded really
 * happened. It moves nothing — see transport_status_confirmation_spec.md §1.
 *
 * Addressed by quote id because that is the only identifier the Flutter client
 * holds. The route resolves the credential and hands it down; the service
 * decides whether this caller may answer for this quote.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireExpedionCaller } from "@/lib/expedion-auth";
import { expedionErrorResponse } from "@/lib/expedion-response";
import { confirmMilestoneBodySchema } from "@/server/dto/shipment.dto";
import { shipmentConfirmationsService } from "@/server/services/shipment-confirmations.service";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireExpedionCaller(req);
    const { id } = await params;
    const input = confirmMilestoneBodySchema.parse(await req.json());

    return NextResponse.json({
      success: true,
      data: await shipmentConfirmationsService.attestForQuote(id, caller, input),
    });
  } catch (error) {
    return expedionErrorResponse(error);
  }
}
