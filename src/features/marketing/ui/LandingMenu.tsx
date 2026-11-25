"use client";

import Link from "next/link";
import { useId, type CSSProperties, type Ref } from "react";
import { useTranslations } from "next-intl";
import { ArrowUpRight, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { BrandWordmark } from "@/components/ui/brand-mark";
import { LandingGatedButton } from "./LandingGatedButton";
import { LandingLangToggle, LandingThemeSwitch } from "./LandingControls";
import { LP_BTN_GHOST, LP_BTN_PRIMARY } from "./styles";

/**
 * Sections of the home page, largest first in the menu. Every `href` must
 * name an id the page renders (`landing-anchors.test.tsx` opens the menu and
 * checks).
 */
export const MENU_SECTIONS = [
  { href: "/#recent", key: "recent" },
  { href: "/#shippers", key: "services" },
  { href: "/#how", key: "howItWorks" },
  { href: "/#promises", key: "promises" },
  { href: "/#app", key: "tour" },
  { href: "/#carriers", key: "carriers" },
  { href: "/#faq", key: "faq" },
] as const;

/** Real routes only: each has a page behind it (`LandingMenu.test.tsx`). */
const MENU_ROUTES = [
  { href: "/create", key: "request" },
  { href: "/help", key: "help" },
  { href: "/contact", key: "contact" },
] as const;

const BIG_LINK =
  "group flex items-baseline gap-3 py-1 text-[2.1rem] leading-[1.08] font-extrabold tracking-[-0.04em] text-[var(--lp-text)] sm:gap-4 sm:text-[3rem] lg:text-[3.6rem]";

const SMALL_LINK =
  "inline-flex items-center gap-1.5 text-[1.05rem] font-semibold text-[var(--lp-text)]";

/** Each line arrives a beat after the one above; none under reduced motion. */
const stagger = (index: number): CSSProperties => ({ animationDelay: `${80 + index * 45}ms` });
const ARRIVE = "animate-in fade-in-0 slide-in-from-bottom-3 fill-mode-both duration-500 motion-reduce:animate-none";

function SectionLinks({ onNavigate }: { onNavigate: () => void }) {
  const t = useTranslations("marketing.navbar");
  return (
    <nav aria-label={t("menuSections")}>
      <ol className="m-0 flex list-none flex-col gap-1 p-0 sm:gap-2">
        {MENU_SECTIONS.map((link, index) => (
          <li key={link.href} className={ARRIVE} style={stagger(index)}>
            <Link href={link.href} onClick={onNavigate} className={BIG_LINK}>
              <span aria-hidden className="font-mono text-[0.8rem] font-medium tracking-normal text-[var(--lp-bluelink)] sm:text-[0.95rem]">
                {String(index + 1).padStart(2, "0")}
              </span>
              {t(link.key)}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function AccountLinks({ onNavigate }: { onNavigate: () => void }) {
  const t = useTranslations("marketing.navbar");
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) {
    return (
      <Link href="/home" onClick={onNavigate} className={`${LP_BTN_PRIMARY} px-5 py-3 text-center text-[15px]`}>
        {t("openApp")}
      </Link>
    );
  }
  return (
    <div className="flex flex-wrap gap-2.5">
      <LandingGatedButton
        intent="carrier"
        label={t("becomeCarrier")}
        className={`${LP_BTN_PRIMARY} px-5 py-3 text-[15px]`}
      />
      <Link href="/signin" onClick={onNavigate} className={`${LP_BTN_GHOST} px-5 py-3 text-[15px]`}>
        {t("login")}
      </Link>
      <Link href="/signup" onClick={onNavigate} className={`${LP_BTN_GHOST} px-5 py-3 text-[15px]`}>
        {t("signUp")}
      </Link>
    </div>
  );
}

function SideColumn({ onNavigate }: { onNavigate: () => void }) {
  const t = useTranslations("marketing.navbar");
  return (
    <div className={`${ARRIVE} flex flex-col gap-8 lg:pt-3`} style={stagger(MENU_SECTIONS.length)}>
      <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
        {MENU_ROUTES.map((route) => (
          <li key={route.href}>
            <Link href={route.href} onClick={onNavigate} className={SMALL_LINK}>
              {t(route.key)}
              <ArrowUpRight className="h-4 w-4 text-[var(--lp-dim)]" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <AccountLinks onNavigate={onNavigate} />
      <div className="flex flex-col gap-3">
        <span className="text-[13px] font-medium text-[var(--lp-muted)]">{t("menuPreferences")}</span>
        <div className="flex flex-wrap items-center gap-3">
          <LandingLangToggle />
          <LandingThemeSwitch />
        </div>
      </div>
    </div>
  );
}

/**
 * The full-screen menu (landing_2026_11_spec.md §1.2), in the manner of the
 * reference's: the page's sections in large type, then the routes that lead
 * off it and the two preferences. No socials — there are none to link.
 * Dialog behaviour lives in `useMenuDialog`; this is only what it shows.
 */
export function LandingMenu({
  id,
  panelRef,
  onClose,
}: {
  id: string;
  panelRef: Ref<HTMLDivElement>;
  onClose: () => void;
}) {
  const t = useTranslations("marketing.navbar");
  const titleId = useId();

  return (
    <div
      ref={panelRef}
      id={id}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-lenis-prevent
      className="lp fixed inset-0 z-[70] overflow-y-auto font-sans animate-in fade-in-0 duration-300 motion-reduce:animate-none"
      style={{ background: "var(--lp-bg2)" }}
    >
      <div className="mx-auto flex min-h-full w-full max-w-[1240px] flex-col px-5 pt-[22px] pb-12 sm:px-9">
        <div className="flex h-[52px] items-center justify-between gap-4">
          <Link href="/#top" onClick={onClose} className="flex items-center" aria-label="Expeditop">
            <BrandWordmark size={28} tagline />
          </Link>
          <h2 id={titleId} className="sr-only">
            {t("menu")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("menuClose")}
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-[var(--lp-line2)] bg-transparent text-[var(--lp-text)] transition-colors hover:bg-[var(--lp-chip)]"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="mt-10 grid flex-1 grid-cols-1 gap-12 lg:mt-16 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <SectionLinks onNavigate={onClose} />
          <SideColumn onNavigate={onClose} />
        </div>
      </div>
    </div>
  );
}
