"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "@/components/providers/LocaleProvider";
import { locales, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

/**
 * FR | EN segmented control for the app chrome.
 *
 * The landing header has carried one since it shipped (`LandingLangToggle`),
 * and the sibling Expedion app carries the same control in its own header —
 * but inside EXPEDITOO the only way to change language was three levels deep
 * in `/profile` → Settings, which is not where anyone looks for it.
 *
 * Deliberately not a shared component with the landing one: that version is
 * written against the `--lp-*` palette, which only resolves inside a `.lp`
 * root and would render invisible here. Same control, two palettes.
 *
 * No mounted guard is needed. `LocaleProvider` withholds the intl provider
 * until it has read the stored locale, so `useTranslations` cannot run against
 * a locale that is about to change underneath it.
 */
export function LangToggle({ className }: { className?: string }) {
  const { locale, setLocale } = useLocale();
  const t = useTranslations("common.navigation");

  return (
    <div
      className={cn(
        "flex flex-none overflow-hidden rounded-lg border border-border",
        className
      )}
      role="group"
      aria-label={t("language")}
    >
      {locales.map((loc: Locale) => (
        <button
          key={loc}
          type="button"
          onClick={() => setLocale(loc)}
          aria-pressed={locale === loc}
          className={cn(
            "cursor-pointer border-0 px-2.5 py-[7px] font-mono text-[11px] tracking-[0.08em] transition-colors",
            locale === loc
              ? "bg-muted text-foreground"
              : "bg-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {loc.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
