import { NextRequest, NextResponse } from "next/server";

import { verifyEmailCodeSchema } from "@/server/dto/email-code.dto";
import {
  EmailCodeError,
  verifyEmailCode,
} from "@/server/services/email-code.service";
import { fail, handleError, ok } from "@/lib/api-response";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/account/verify-email-code — the six-digit code from the
 * verification mail, typed on `/verify-email` (email_access_code_spec.md §5).
 *
 * Public: the person typing it cannot sign in yet, that is the point. What
 * makes that safe is what a right code grants — the address becomes verified,
 * and nothing else: no session is opened, the password is still asked for.
 * Guessing is capped per code by the service (five tries, then the code is
 * burnt); the per-IP brake here only slows a script down.
 */

export const dynamic = "force-dynamic";

const WINDOW_MS = 60_000;
const LIMIT = 10;

/**
 * The service's refusal, in the usual envelope plus `attemptsLeft` — the one
 * thing the page needs that `fail()` has no slot for.
 */
function refusal(error: EmailCodeError) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.attemptsLeft !== undefined
          ? { attemptsLeft: error.attemptsLeft }
          : {}),
      },
    },
    { status: error.status }
  );
}

export async function POST(req: NextRequest) {
  try {
    const { allowed, retryAfter } = rateLimit(
      `verify-email-code:${clientIp(req.headers)}`,
      LIMIT,
      WINDOW_MS
    );
    if (!allowed) {
      return fail(
        "RATE_LIMITED",
        `Too many attempts. Try again in ${retryAfter} seconds.`,
        429
      );
    }

    // A body that is not JSON is a bad request, not a server fault.
    const body: unknown = await req.json().catch(() => null);
    const { email, code } = verifyEmailCodeSchema.parse(body);
    const { email: verified } = await verifyEmailCode(email, code);
    return ok({ verified: true, email: verified });
  } catch (error) {
    if (error instanceof EmailCodeError) return refusal(error);
    return handleError(error, "Verify email code");
  }
}
