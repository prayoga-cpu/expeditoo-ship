"use client";

import { useState, type ClipboardEvent, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mailbox } from "@/lib/app-url";
import { EMAIL_CODE_LENGTH, codeDigits } from "@/lib/email-code";
import {
  useEmailCodeVerification,
  type EmailCodeStatus,
} from "@/features/auth/hooks/useEmailCodeVerification";

/** The answer to the last code, with its next step in the sentence. */
function CodeOutcome({
  status,
  attemptsLeft,
}: {
  status: EmailCodeStatus;
  attemptsLeft: number | null;
}) {
  const t = useTranslations("auth.verifyEmail");

  const refusal = (): string | null => {
    switch (status) {
      case "invalid":
        return attemptsLeft === null
          ? t("code.invalidNoCount")
          : t("code.invalid", { count: attemptsLeft });
      case "expired":
        return t("code.expired");
      case "tooManyAttempts":
        return t("code.tooManyAttempts");
      case "rateLimited":
        return t("code.rateLimited");
      case "failed":
        return t("code.failed", { support: mailbox("support") });
      default:
        return null;
    }
  };

  if (status === "verified") {
    return (
      <p role="status" className="text-sm text-primary">
        {t("code.verified")}
      </p>
    );
  }
  const message = refusal();
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

/**
 * The field itself: digits only, at most six of them, enforced by `codeDigits`
 * on every change. There is deliberately no `maxLength`: the browser applies it
 * to the raw text before the field sees it, so « 123 456 » inserted in one go
 * (dictation, a keyboard suggestion, an autofill) was cut to « 123 45 » — five
 * digits — and « Valider » could never succeed (found on dev.expeditop.fr,
 * 2026-11-24). A paste is read whole for the same reason.
 */
function CodeField({
  value,
  onChange,
  disabled,
  incomplete,
}: {
  value: string;
  onChange: (raw: string) => void;
  disabled: boolean;
  incomplete: boolean;
}) {
  const t = useTranslations("auth.verifyEmail");

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    onChange(event.clipboardData.getData("text"));
  };

  return (
    <div>
      <label
        htmlFor="email-code"
        className="block text-sm font-medium text-foreground mb-2"
      >
        {t("code.label")}
      </label>
      <Input
        id="email-code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        placeholder={t("code.placeholder")}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onPaste={onPaste}
        disabled={disabled}
        aria-invalid={incomplete}
        aria-describedby="email-code-hint"
        className={`bg-background/50 border-border/50 h-12 text-center font-mono text-2xl tracking-[0.5em] ${incomplete ? "border-destructive" : ""}`}
      />
      <p id="email-code-hint" className="text-muted-foreground text-xs mt-2">
        {t("code.hint")}
      </p>
      {incomplete && (
        <p className="text-destructive text-sm mt-1">{t("code.incomplete")}</p>
      )}
    </div>
  );
}

/**
 * The six-digit code from the verification mail (email_access_code_spec.md
 * §5). One field, digits only, so a pasted « 123 456 » is one code and the
 * phone offers the code from the mail it just received.
 *
 * An expired or burnt code sends the person to the resend button
 * (`onNeedNewCode`): asking for a new one is the only way on from there.
 */
export function EmailCodeForm({
  address,
  callbackUrl,
  onNeedNewCode,
}: {
  /** The address the code was sent to, or `null` once its field has said why not. */
  address: () => string | null;
  callbackUrl?: string | null;
  onNeedNewCode?: () => void;
}) {
  const t = useTranslations("auth.verifyEmail");
  const { status, attemptsLeft, submit, reset } =
    useEmailCodeVerification(callbackUrl);
  const [code, setCode] = useState("");
  const [incomplete, setIncomplete] = useState(false);

  const busy = status === "checking" || status === "verified";

  const change = (raw: string) => {
    setCode(codeDigits(raw));
    setIncomplete(false);
    reset();
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const email = address();
    const complete = code.length === EMAIL_CODE_LENGTH;
    setIncomplete(!complete);
    if (!email || !complete) return;

    const outcome = await submit(email, code);
    if (outcome.status === "expired" || outcome.status === "tooManyAttempts") {
      setCode("");
      onNeedNewCode?.();
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      <CodeField
        value={code}
        onChange={change}
        disabled={busy}
        incomplete={incomplete}
      />

      <Button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === "checking" ? t("code.checking") : t("code.submit")}
      </Button>

      <CodeOutcome status={status} attemptsLeft={attemptsLeft} />
    </form>
  );
}
