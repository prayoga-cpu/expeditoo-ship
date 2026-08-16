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
 * Payment is reported rather than observed because EXPEDITOO does not take
 * the client's money — `expedion_quotes` carries no Stripe payment intent or
 * session, so the Stripe webhook has no way to recognise a quote. Expedion
 * settles on its own side and tells us. If EXPEDITOO ever takes the payment
 * directly, this becomes a webhook branch and the route can go.
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
