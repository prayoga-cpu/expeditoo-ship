"use client";

import type { FormEvent, Ref } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { mailbox } from "@/lib/app-url";
import {
  useResendVerification,
  type ResendStatus,
} from "@/features/auth/hooks/useResendVerification";

/** What the last attempt came to, said with the next step in it. */
function ResendOutcome({ status }: { status: ResendStatus }) {
  const t = useTranslations("auth.verifyEmail");

  if (status === "sent") {
    return (
      <p role="status" className="text-sm text-primary">
        {t("resent")} {t("resentHint")}
      </p>
    );
  }
  if (status === "rateLimited") {
    return (
      <p role="alert" className="text-sm text-destructive">
        {t("resendRateLimited")}
      </p>
    );
  }
  if (status === "failed") {
    return (
      <p role="alert" className="text-sm text-destructive">
        {t("resendFailed", { support: mailbox("support") })}
      </p>
    );
  }
  return null;
}

/**
 * « Renvoyer l'email » for the verify-email screen.
 *
 * The address comes from the screen (`VerifyEmailActions`), which shares it
 * with the code field and says itself when it is not one. A failure keeps the
 * button live: retrying is the way out, and the message names the other one.
 * `buttonRef` is how the code field sends the person here when their code has
 * expired.
 */
export function ResendVerification({
  address,
  buttonRef,
}: {
  /** The address to send to, or `null` once the field has said why not. */
  address: () => string | null;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  const t = useTranslations("auth.verifyEmail");
  const { status, secondsLeft, resend } = useResendVerification();

  const sending = status === "sending";
  const waiting = secondsLeft > 0;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const email = address();
    if (email) void resend(email);
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      <Button
        ref={buttonRef}
        type="submit"
        disabled={sending || waiting}
        variant="outline"
        className="w-full rounded-xl border-border/50 hover:bg-muted/50 text-foreground font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {sending
          ? t("resending")
          : waiting
            ? t("resendIn", { seconds: secondsLeft })
            : t("resend")}
      </Button>

      <ResendOutcome status={status} />
    </form>
  );
}
