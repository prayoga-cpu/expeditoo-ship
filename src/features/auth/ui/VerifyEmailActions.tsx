"use client";

import { useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { EmailCodeForm } from "./EmailCodeForm";
import { ResendVerification } from "./ResendVerification";

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Everything `/verify-email` offers a person waiting on a mail: the code from
 * it, and another one (email_access_code_spec.md §5).
 *
 * Both act on one address. When the page was handed it (`?email=`, from
 * sign-up or a refused sign-in) it is not asked for again; when it was not —
 * a link that failed, a typed URL — one field above both asks for it, and
 * either button says when it is not an address.
 */
export function VerifyEmailActions({
  initialEmail,
  callbackUrl,
  children,
}: {
  initialEmail?: string;
  /** Where sign-in should go once the address is verified (checked downstream). */
  callbackUrl?: string | null;
  /** Shown between the code and the resend: the « nothing arrived? » note. */
  children?: ReactNode;
}) {
  const t = useTranslations("auth.verifyEmail");
  // A handed address that is not one (a hand-typed URL) is shown to be
  // corrected rather than hidden behind buttons that would do nothing.
  const handed = EMAIL_SHAPE.test(initialEmail?.trim() ?? "");
  const [email, setEmail] = useState(initialEmail ?? "");
  const [invalid, setInvalid] = useState(false);
  const resendRef = useRef<HTMLButtonElement>(null);

  const address = (): string | null => {
    const value = email.trim();
    const valid = EMAIL_SHAPE.test(value);
    setInvalid(!valid);
    return valid ? value : null;
  };

  return (
    <div className="space-y-4">
      {!handed && (
        <div>
          <label
            htmlFor="verify-email-address"
            className="block text-sm font-medium text-foreground mb-2"
          >
            {t("emailLabel")}
          </label>
          <Input
            id="verify-email-address"
            type="email"
            autoComplete="email"
            placeholder={t("emailPlaceholder")}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={invalid}
            className={`bg-background/50 border-border/50 ${invalid ? "border-destructive" : ""}`}
          />
          {invalid && (
            <p className="text-destructive text-sm mt-1">{t("emailInvalid")}</p>
          )}
        </div>
      )}

      <EmailCodeForm
        address={address}
        callbackUrl={callbackUrl}
        onNeedNewCode={() => resendRef.current?.focus()}
      />

      {children}

      <ResendVerification address={address} buttonRef={resendRef} />
    </div>
  );
}
