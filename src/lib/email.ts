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
