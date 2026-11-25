"use client";

import { enUS, fr } from "date-fns/locale";
import { useLocale } from "next-intl";

/**
 * The date-fns locale for the language the app is being read in.
 *
 * `format(date, "d MMM")` with no locale always writes English month names,
 * whatever the toggle says. Pass this as `{ locale }` wherever a pattern
 * prints a name or a relative time.
 */
export function useDateLocale() {
  return useLocale() === "fr" ? fr : enUS;
}
