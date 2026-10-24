import { Resend } from "resend";
import { isProductionEnv } from "@/lib/env";

const apiKey = process.env.RESEND_API_KEY;

// Initialize Resend client only if API key is present
// Otherwise we'll handle it in the service layer (mock mode)
export const resend = apiKey ? new Resend(apiKey) : null;

export const EMAIL_FROM =
  process.env.EMAIL_FROM || "Expeditoo <onboarding@resend.dev>";

type ResendSendPayload = Parameters<NonNullable<typeof resend>["emails"]["send"]>[0];

/**
 * The one place a real email is allowed to leave this process.
 *
 * Outside production every recipient is rewritten to `EMAIL_DEV_RECIPIENT` —
 * or the send is dropped (logged, not sent) when that is unset — so a local
 * `pnpm dev` session, a seed script, or a preview deployment can never land a
 * verification link or a shipment update in a real driver's inbox. This
 * matters beyond local dev: `next build` sets `NODE_ENV=production` for
 * Preview deployments too, which is why the redirect below is keyed on
 * `isProductionEnv` (derived from `VERCEL_ENV`) rather than `NODE_ENV`.
 *
 * Every call site must send through this — `auth.service.ts` and
 * `email.service.ts` — never `resend.emails.send` directly, or it bypasses
 * the redirect.
 */
export async function sendViaResend(payload: ResendSendPayload) {
  if (!resend) {
    throw new Error("RESEND_API_KEY is not set");
  }

  if (isProductionEnv) {
    return resend.emails.send(payload);
  }

  const devRecipient = process.env.EMAIL_DEV_RECIPIENT;

  if (!devRecipient) {
    console.log(
      `[email] Dropped (EMAIL_DEV_RECIPIENT unset) — would have sent "${payload.subject}" to ${JSON.stringify(payload.to)}`
    );
    return { data: null, error: null };
  }

  console.log(
    `[email] Redirecting "${payload.subject}" from ${JSON.stringify(payload.to)} to ${devRecipient} (outside production)`
  );
  return resend.emails.send({ ...payload, to: devRecipient });
}

/**
 * Throws when Resend answered a send with an error.
 *
 * The SDK *returns* `{ data, error }` rather than throwing, so a caller that
 * only awaits the call treats a refusal as a success. That is how password
 * reset mail went missing with nothing in any log: production sends from
 * Resend's sandbox sender, which refuses every address but the account
 * owner's (client feedback 2026-10-21, §C4). Callers already wrap the send in
 * a try that logs, so throwing here is what puts the refusal in that log.
 */
export function assertSent(
  result: { error: { message: string; name?: string } | null } | null | undefined,
  what: string
): void {
  const error = result?.error;
  if (!error) return;
  const sandbox = /testing emails|verify a domain|own email address/i.test(
    error.message
  );
  throw new Error(
    `[email] Resend refused the ${what}: ${error.message}` +
      (sandbox
        ? " — the sender is not on a verified domain; verify one in Resend and set EMAIL_FROM (STATUS.md → Operator to-do)."
        : "")
  );
}
