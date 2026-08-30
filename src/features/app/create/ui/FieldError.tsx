"use client";

import { useTranslations } from "next-intl";

/**
 * Validation messages are translation keys, not sentences — a Zod schema has no
 * access to `useTranslations`. Anything that is not a known key is shown as-is
 * so a server message still reaches the reader rather than vanishing.
 */
export function FieldError({ message }: { message?: string }) {
  const t = useTranslations();
  if (!message) return null;
  const text = message.startsWith("create.validation.") ? t(message) : message;
  return <p className="mt-1 text-sm text-destructive">{text}</p>;
}
