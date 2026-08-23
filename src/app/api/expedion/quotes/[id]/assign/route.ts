/**
 * POST /api/expedion/quotes/:id/assign
 *
 * Hands a paid job to a driver in the pool, instead of publishing it for
 * carriers to bid on. The other half of the fork a payment opens.
 *
 * Separate from `PATCH /admin`, which is how assignment used to happen: that
 * route wrote `assignedCarrierId` onto the quote and nothing else, so the
 * driver never saw the job, no money was held, and only an admin editing the
 * status by hand could finish it. `assignDirect` runs the same award machinery
 * the marketplace uses, so the two lanes produce the same execution record.
 *
 * Admin-guarded, and `acceptOffer` re-checks the `operator`/`admin` role of
 * the caller underneath — awarding is an operator permission, not an owner
 * one, because the listing is owned by a system account nobody signs into.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireExpedionAdmin } from "@/lib/expedion-auth";
import { expedionErrorResponse } from "@/lib/expedion-response";
import { expedionEscalationService } from "@/server/services/expedion-escalation.service";

export const dynamic = "force-dynamic";

const assignSchema = z.object({
  /** A `carriers.id`, as the operator's picker yields it. */
  carrierId: z.string().min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireExpedionAdmin(req);
    const { id } = await params;
    const { carrierId } = assignSchema.parse(await req.json());

    const { listing, shipment } = await expedionEscalationService.assignDirect(
      id,
      carrierId,
      caller.userId
    );

    return NextResponse.json({
      success: true,
      data: {
        listingId: listing.id,
        shipmentId: shipment?.id ?? null,
        assignedBy: caller.userId,
      },
    });
  } catch (error) {
    return expedionErrorResponse(error);
  }
}
