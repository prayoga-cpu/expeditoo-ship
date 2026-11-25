"use client";

import { useSyncExternalStore } from "react";

import { defaultLocale, isValidLocale, type Locale } from "@/i18n/config";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";

const CLOSE_LABEL: Record<Locale, string> = {
  fr: fr.common.close,
  en: en.common.close,
};

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["lang"],
  });
  return () => observer.disconnect();
}

const readLang = () => document.documentElement.lang;
const serverLang = () => defaultLocale;

/**
 * The accessible name of a dialog's or a sheet's close cross, in the language
 * the page is being read in.
 *
 * It does not go through `useTranslations` on purpose. These primitives are
 * rendered outside an intl provider too (a test that mounts a dialog bare, a
 * suite that mocks `next-intl` down to one export), and there the hook throws.
 * `LocaleProvider` keeps `<html lang>` in step with the locale it renders, so
 * that attribute is read instead: it never throws, and it falls back to the
 * product's default language when nothing has stamped it.
 */
export function useCloseLabel(): string {
  const lang = useSyncExternalStore(subscribe, readLang, serverLang);
  return CLOSE_LABEL[isValidLocale(lang) ? lang : defaultLocale];
}
