/**
 * POST /api/expedion/quotes/:id/requote
 *
 * Unwinds a settled quote so the client can be re-quoted at a corrected price.
 *
 * The correction path for a paid quote, because editing the price in place is
 * refused (`PRICE_LOCKED`) — that would leave the recorded amount disagreeing
 * with what Stripe captured. Going back to `quoted` and having the client
 * accept and pay again keeps the two in step at every step.
 *
 * It does not move money. EXPEDITOO never took the client's payment (see
 * `POST /quotes/:id/paid`), so the refund is issued on the Expedion side; the
 * response carries the Checkout reference to issue it against.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireExpedionAdmin } from "@/lib/expedion-auth";
import { expedionErrorResponse } from "@/lib/expedion-response";
import { expedionService } from "@/server/services/expedion.service";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireExpedionAdmin(req);
    const { id } = await params;

    const { quote, refundedCents, paymentReference } =
      await expedionService.cancelAndRequote(id, caller.userId);

    return NextResponse.json({
      success: true,
      data: {
        quote,
        refundedCents,
        // The Stripe Checkout session to refund against, on the Expedion side.
        // Null when the payment predates the reference being recorded.
        paymentReference,
        refundIssued: false,
      },
    });
  } catch (error) {
    return expedionErrorResponse(error);
  }
}
