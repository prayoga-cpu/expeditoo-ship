"use client";

import { useLocale } from "next-intl";

/**
 * A rating written the way the reader's language writes a decimal, always to
 * one place: « 4,5 » in French, "4.5" in English.
 *
 * `rating.toFixed(1)` prints a point whatever the toggle says.
 */
export function formatRating(rating: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(rating);
}

/** `formatRating` bound to the language the app is being read in. */
export function useFormatRating() {
  const locale = useLocale();
  return (rating: number | null | undefined) =>
    formatRating(rating ?? 0, locale);
}
