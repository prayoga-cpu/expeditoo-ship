/**
 * POST /api/expedion/quotes/:id/escalate
 *
 * Admin-forced escalation, ahead of the auto-escalate timer. The window is an
 * upper bound, not a wait an admin has to sit through when they already know
 * nobody in the pool can take a job.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireExpedionAdmin } from "@/lib/expedion-auth";
import { expedionErrorResponse } from "@/lib/expedion-response";
import { expedionEscalationService } from "@/server/services/expedion-escalation.service";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = requireExpedionAdmin(req);
    const { id } = await params;

    const { quote, listing } = await expedionEscalationService.escalate(id, {
      reason: "Escalade forcée par un administrateur",
      actor: "admin",
    });

    return NextResponse.json({
      success: true,
      data: { quote, listingId: listing.id, escalatedBy: caller.firebaseUid },
    });
  } catch (error) {
    return expedionErrorResponse(error);
  }
}
