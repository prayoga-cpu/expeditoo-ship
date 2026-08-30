/**
 * Client confirmation by one-tap link.
 *
 * The only route in the app that writes without a session. That is defensible
 * because the signed token is a capability to record one attestation and
 * nothing else: it cannot move a status, capture a payment or close a listing
 * (transport_status_confirmation_spec.md §6), and the unique index on
 * `shipment_confirmations` makes it unreplayable.
 *
 * GET  ?token=…  what the landing page renders
 * POST { token }  record the confirmation
 */

import { NextRequest } from "next/server";
import { shipmentConfirmationsService } from "@/server/services/shipment-confirmations.service";
import { confirmByTokenSchema } from "@/server/dto/shipment.dto";
import { ok, fail, handleError } from "@/lib/api-response";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const WINDOW_MS = 60_000;
const READ_LIMIT = 30;
const WRITE_LIMIT = 10;

function limited(req: NextRequest, bucket: string, limit: number) {
  const { allowed, retryAfter } = rateLimit(
    `confirm:${bucket}:${clientIp(req.headers)}`,
    limit,
    WINDOW_MS
  );
  if (allowed) return null;
  return fail(
    "RATE_LIMITED",
    `Too many attempts. Try again in ${retryAfter}s`,
    429
  );
}

export async function GET(req: NextRequest) {
  try {
    const blocked = limited(req, "read", READ_LIMIT);
    if (blocked) return blocked;

    const token = new URL(req.url).searchParams.get("token") ?? "";
    return ok(await shipmentConfirmationsService.describeToken(token));
  } catch (error) {
    return handleError(error, "Describe confirmation token");
  }
}

export async function POST(req: NextRequest) {
  try {
    const blocked = limited(req, "write", WRITE_LIMIT);
    if (blocked) return blocked;

    const { token, note } = confirmByTokenSchema.parse(await req.json());
    return ok(await shipmentConfirmationsService.attestFromToken(token, note));
  } catch (error) {
    return handleError(error, "Confirm shipment by token");
  }
}
