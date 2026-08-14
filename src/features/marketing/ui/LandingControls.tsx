"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { useLocale } from "@/components/providers/LocaleProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { locales, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

/** FR | EN segmented control, styled as the landing header specifies. */
export function LandingLangToggle() {
  const { locale, setLocale } = useLocale();
  const t = useTranslations("marketing.navbar");

  return (
    <div
      className="flex flex-none overflow-hidden rounded-lg border border-[var(--lp-line2)]"
      role="group"
      aria-label={t("langLabel")}
    >
      {locales.map((loc: Locale) => (
        <button
          key={loc}
          type="button"
          onClick={() => setLocale(loc)}
          aria-pressed={locale === loc}
          className={cn(
            "cursor-pointer border-0 px-2.5 py-[7px] font-mono text-[11px] tracking-[0.08em]",
            locale === loc
              ? "bg-[rgba(127,127,127,0.14)] text-[var(--lp-text)]"
              : "bg-transparent text-[var(--lp-dim)]"
          )}
        >
          {loc.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

const THEME_OPTIONS = [
  { value: "light", icon: Sun, labelKey: "themeLight" },
  { value: "dark", icon: Moon, labelKey: "themeDark" },
  { value: "system", icon: Monitor, labelKey: "themeSystem" },
] as const;

/** Borderless 34px hit target, sized so the header keeps its rhythm. */
const THEME_TRIGGER =
  "flex h-[34px] w-[34px] flex-none cursor-pointer items-center justify-center rounded-[9px] border-0 bg-transparent text-[var(--lp-text)] transition-colors hover:bg-[var(--lp-chip)]";

/**
 * Light / dark / system menu, ticking the active row — the same control the
 * app header carries.
 */
export function LandingThemeToggle() {
  const { theme, setTheme } = useTheme();
  const t = useTranslations("marketing.navbar");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  // `theme` is only known once next-themes has read storage, so until then the
  // trigger is inert rather than briefly showing someone else's choice.
  if (!mounted) {
    return (
      <button
        type="button"
        aria-label={t("themeLabel")}
        className={THEME_TRIGGER}
        disabled
      >
        <Sun className="h-[18px] w-[18px]" />
      </button>
    );
  }

  const active =
    THEME_OPTIONS.find((option) => option.value === theme) ?? THEME_OPTIONS[0];
  const ActiveIcon = active.icon;

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={t("themeLabel")}
          aria-label={t("themeLabel")}
          className={THEME_TRIGGER}
        >
          <ActiveIcon className="h-[18px] w-[18px]" />
        </button>
      </DropdownMenuTrigger>
      {/* Radix portals the menu to <body>, outside the `.lp` root, so it
          carries the class itself to resolve the landing palette. `.lp` is
          unlayered and outranks a `bg-*` utility, hence the inline surface. */}
      <DropdownMenuContent
        align="end"
        className="lp w-40 rounded-[14px] border-[var(--lp-line)] p-1.5 text-[var(--lp-text)] shadow-[var(--lp-shadow)]"
        style={{ background: "var(--lp-bg2)" }}
      >
        {THEME_OPTIONS.map(({ value, icon: Icon, labelKey }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => setTheme(value)}
            className="cursor-pointer rounded-lg px-2.5 py-2 text-[14.5px] focus:bg-[var(--lp-chip)] focus:text-[var(--lp-text)]"
          >
            <Icon className="mr-2 h-[18px] w-[18px] text-[var(--lp-muted)]" />
            <span>{t(labelKey)}</span>
            {theme === value && (
              <span className="ml-auto text-[var(--lp-bluelink)]">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
