"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  verifyEmailCode,
  type EmailCodeOutcome,
} from "@/features/auth/api/email-code.api";
import { safeCallbackPath } from "@/lib/safe-redirect";

export type EmailCodeStatus = "idle" | "checking" | EmailCodeOutcome["status"];

/**
 * Where a verified address goes: sign-in, with the address filled in and the
 * page the person was headed to still ahead of them. A code never signs
 * anybody in — the password is still asked for (email_access_code_spec.md §5).
 */
export function signInAfterVerification(
  email: string | null | undefined,
  callbackUrl?: string | null
): string {
  const query = new URLSearchParams({ verified: "true" });
  if (email) query.set("email", email);
  const next = safeCallbackPath(callbackUrl);
  if (next) query.set("callbackUrl", next);
  return `/signin?${query.toString()}`;
}

/** The emailed code, checked; a right one moves on to sign-in. */
export function useEmailCodeVerification(callbackUrl?: string | null) {
  const router = useRouter();
  const [status, setStatus] = useState<EmailCodeStatus>("idle");
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);

  const submit = useCallback(
    async (email: string, code: string): Promise<EmailCodeOutcome> => {
      setStatus("checking");
      const outcome = await verifyEmailCode(email, code);

      setAttemptsLeft(outcome.status === "invalid" ? outcome.attemptsLeft : null);
      setStatus(outcome.status);
      if (outcome.status === "verified") {
        router.push(signInAfterVerification(outcome.email, callbackUrl));
      }
      return outcome;
    },
    [router, callbackUrl]
  );

  /** Typing again clears the last answer: it was about the previous code. */
  const reset = useCallback(() => {
    setStatus((current) => (current === "checking" ? current : "idle"));
  }, []);

  return { status, attemptsLeft, submit, reset };
}
