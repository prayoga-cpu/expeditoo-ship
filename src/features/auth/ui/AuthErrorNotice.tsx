"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { mailbox } from "@/lib/app-url";
import {
  AUTH_ERROR_ACTIONS,
  type AuthErrorAction,
  type AuthErrorKey,
} from "@/features/auth/lib/auth-errors";
import { carriedIntentQuery } from "./AuthSwitchLink";

/**
 * The red box on every auth form: what was refused, in the person's language,
 * and what to do about it (`auth-errors.ts`). It takes a key and never a
 * sentence, so a server string cannot reach the screen through it.
 */
export function AuthErrorNotice({
  error,
  className = "mb-4",
}: {
  error: AuthErrorKey | null;
  className?: string;
}) {
  const t = useTranslations("auth.errors");
  const router = useRouter();

  if (!error) return null;

  // Read at click time rather than through `useSearchParams`, which would
  // force a Suspense boundary onto pages that have no other use for one.
  const follow = (action: AuthErrorAction) => {
    const intent =
      action.href === "/signin"
        ? carriedIntentQuery(new URLSearchParams(window.location.search))
        : "";
    router.push(`${action.href}${intent}`);
  };

  return (
    <div
      role="alert"
      className={`p-3 bg-destructive/10 border border-destructive/20 rounded-lg ${className}`}
    >
      <p className="text-destructive text-sm">
        {t(error, { support: mailbox("support") })}
      </p>
      {AUTH_ERROR_ACTIONS[error].length > 0 && (
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {AUTH_ERROR_ACTIONS[error].map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => follow(action)}
              className="text-primary hover:text-primary/80 font-semibold"
            >
              {t(`actions.${action.label}`)}
            </button>
          ))}
        </p>
      )}
    </div>
  );
}
