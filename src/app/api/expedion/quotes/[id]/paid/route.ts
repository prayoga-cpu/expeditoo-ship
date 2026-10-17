/**
 * POST /api/expedion/quotes/:id/paid
 *
 * Expedion reports that a quote's payment has settled.
 *
 * This is what starts the escalation clock: `markPaid` stamps `escalateAfter`
 * at now + the configured window, and that column is the only thing
 * `findDueForEscalation` selects on. Until this route existed `markPaid` had
 * no caller at all, so the column was never written, the auto-escalation cron
 * swept nothing on real data, and only admin-forced escalation worked.
 *
 * Expedion takes the client's money on its own side and reports it here when
 * the client's browser comes back from Checkout. Since 2.64.1 the Stripe
 * webhook also observes it — the intent carries the quote id as `recordID` —
 * so a client who closes the tab before the redirect is still recorded paid
 * (`expedionService.recordStripePayment`, launch_readiness_spec.md §F). Both
 * paths reach `markPaid`, which is idempotent.
 *
 * Admin-guarded: "this has been paid" is a privileged assertion, and a client
 * must not be able to declare their own quote paid and pull a driver onto an
 * unfunded job.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireExpedionAdmin } from "@/lib/expedion-auth";
import { expedionErrorResponse } from "@/lib/expedion-response";
import { expedionService } from "@/server/services/expedion.service";

export const dynamic = "force-dynamic";

/**
 * Free-form provenance for the event feed — typically the payment reference on
 * the Expedion side. Recorded, never interpreted.
 */
const markPaidSchema = z
  .object({
    reference: z.string().min(1).max(200).optional(),
    method: z.string().min(1).max(60).optional(),
  })
  .optional();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireExpedionAdmin(req);
    const { id } = await params;

    // An empty body is legitimate: the assertion alone is the payload.
    const raw = await req.text();
    const input = markPaidSchema.parse(raw ? JSON.parse(raw) : undefined);

    const quote = await expedionService.markPaid(id, {
      ...input,
      reportedBy: caller.userId,
      via: caller.via,
    });

    return NextResponse.json({
      success: true,
      data: {
        quote,
        escalateAfter: quote.escalateAfter,
      },
    });
  } catch (error) {
    return expedionErrorResponse(error);
  }
}
