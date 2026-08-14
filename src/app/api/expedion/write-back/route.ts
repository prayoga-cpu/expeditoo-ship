/**
 * POST /api/expedion/write-back
 *
 * Expeditoo → Expedion status write-back. Fired when a carrier is selected on
 * an escalated job and at each delivery stage, so the Expedion client sees the
 * chosen carrier and live status without leaving their app.
 *
 * Admin-keyed: this moves a job's state, so the client key must not reach it.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireExpedionAdmin } from "@/lib/expedion-auth";
import { expedionErrorResponse } from "@/lib/expedion-response";
import { expedionWriteBackSchema } from "@/server/dto/expedion.dto";
import { expedionBridgeService } from "@/server/services/expedion-bridge.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    await requireExpedionAdmin(req);
    const input = expedionWriteBackSchema.parse(await req.json());
    const quote = await expedionBridgeService.writeBack(input);
    return NextResponse.json({ success: true, data: quote });
  } catch (error) {
    return expedionErrorResponse(error);
  }
}
