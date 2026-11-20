"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mailbox } from "@/lib/app-url";
import {
  useResendVerification,
  type ResendStatus,
} from "@/features/auth/hooks/useResendVerification";

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
 * Asks for the address only when the page was not handed one — a visitor who
 * arrives from an expired link, or who typed the URL. A failure keeps the
 * button live: retrying is the way out, and the message names the other one.
 */
export function ResendVerification({ initialEmail }: { initialEmail?: string }) {
  const t = useTranslations("auth.verifyEmail");
  const { status, secondsLeft, resend } = useResendVerification();
  const [email, setEmail] = useState(initialEmail ?? "");
  const [invalid, setInvalid] = useState(false);

  const sending = status === "sending";
  const waiting = secondsLeft > 0;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const address = email.trim();
    if (!EMAIL_SHAPE.test(address)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    void resend(address);
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      {!initialEmail && (
        <div>
          <label
            htmlFor="resend-email"
            className="block text-sm font-medium text-foreground mb-2"
          >
            {t("emailLabel")}
          </label>
          <Input
            id="resend-email"
            type="email"
            autoComplete="email"
            placeholder={t("emailPlaceholder")}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={sending}
            aria-invalid={invalid}
            className={`bg-background/50 border-border/50 ${invalid ? "border-destructive" : ""}`}
          />
          {invalid && (
            <p className="text-destructive text-sm mt-1">{t("emailInvalid")}</p>
          )}
        </div>
      )}

      <Button
        type="submit"
        disabled={sending || waiting}
        className="w-full rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
