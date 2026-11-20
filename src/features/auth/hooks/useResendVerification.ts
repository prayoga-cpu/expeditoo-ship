"use client";

import { useCallback, useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

/** Seconds the button rests after a send that went through, or a 429. */
export const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Where a verified address lands. The server rewrites this for an Expedion
 * account (`brandingFor`, auth.service.ts); it is named here so a link sent
 * from this screen is never left on Better Auth's default of `/`.
 */
const VERIFIED_CALLBACK = "/signin?verified=true";

export type ResendStatus = "idle" | "sending" | "sent" | "failed" | "rateLimited";

/**
 * « Renvoyer l'email » — Better Auth's own `send-verification-email`, so the
 * link carries a real token.
 *
 * `failed` is a real failure: the server answers an error on this path when
 * the mail did not leave (`isVerificationResend`, auth.service.ts). It applies
 * no cooldown — trying again is the way out, and the button must stay live.
 */
export function useResendVerification() {
  const [status, setStatus] = useState<ResendStatus>("idle");
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((left) => left - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const resend = useCallback(async (email: string) => {
    setStatus("sending");

    try {
      const result = await authClient.sendVerificationEmail({
        email,
        callbackURL: VERIFIED_CALLBACK,
      });

      if (result.error) {
        const limited = result.error.status === 429;
        if (limited) setSecondsLeft(RESEND_COOLDOWN_SECONDS);
        setStatus(limited ? "rateLimited" : "failed");
        return;
      }

      setSecondsLeft(RESEND_COOLDOWN_SECONDS);
      setStatus("sent");
    } catch {
      // The request never reached the server (offline, blocked).
      setStatus("failed");
    }
  }, []);

  return { status, secondsLeft, resend };
}
