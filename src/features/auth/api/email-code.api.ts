import type { ApiEnvelope } from "@/lib/fetcher";
import type { VerifyEmailCodeResult } from "@/server/dto/email-code.dto";

/**
 * What the code check came to, as the page needs it. Everything is a value,
 * never a throw: each answer is a sentence on the screen with a next step.
 */
export type EmailCodeOutcome =
  | { status: "verified"; email: string }
  | { status: "invalid"; attemptsLeft: number | null }
  | { status: "expired" }
  | { status: "tooManyAttempts" }
  | { status: "rateLimited" }
  | { status: "failed" };

/** The route's error, which adds `attemptsLeft` to the usual envelope. */
interface Refusal {
  code: string;
  message: string;
  attemptsLeft?: unknown;
}

type Envelope = Omit<ApiEnvelope<VerifyEmailCodeResult>, "error"> & {
  error?: Refusal;
};

/** The answers that carry nothing but their name. */
type PlainStatus = Exclude<EmailCodeOutcome["status"], "verified" | "invalid">;

const BY_CODE: Readonly<Record<string, PlainStatus>> = {
  CODE_EXPIRED: "expired",
  TOO_MANY_ATTEMPTS: "tooManyAttempts",
  RATE_LIMITED: "rateLimited",
};

function outcomeOf(error: Refusal | undefined): EmailCodeOutcome {
  const code = error?.code ?? "";
  if (code === "INVALID_CODE") {
    const left = error?.attemptsLeft;
    return { status: "invalid", attemptsLeft: typeof left === "number" ? left : null };
  }
  const status: PlainStatus = Object.hasOwn(BY_CODE, code) ? BY_CODE[code] : "failed";
  return { status };
}

/**
 * `POST /api/account/verify-email-code`.
 *
 * Its own `fetch` rather than `api.post`: a wrong code answers how many tries
 * are left (`error.attemptsLeft`), and `ApiError` carries only a code and a
 * message.
 */
export async function verifyEmailCode(
  email: string,
  code: string
): Promise<EmailCodeOutcome> {
  try {
    const res = await fetch("/api/account/verify-email-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    const envelope = (await res.json()) as Envelope;
    if (res.ok && envelope.success && envelope.data) {
      return { status: "verified", email: envelope.data.email };
    }
    return outcomeOf(envelope.error);
  } catch {
    // Never reached the server, or answered something that is not JSON.
    return { status: "failed" };
  }
}
