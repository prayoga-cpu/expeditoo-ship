"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { BrandWordmark } from "@/components/ui/brand-mark";
import { LandingGatedButton } from "./LandingGatedButton";
import { LandingLangToggle, LandingThemeToggle } from "./LandingControls";
import { LP_BTN_PRIMARY } from "./styles";

/**
 * Anchors into the landing page. Every entry must name a section that page
 * still renders: « Courses » and « Plateforme » pointed at `#courses` and
 * `#platform` after both sections were cut (2.95.0), and a link to a missing
 * id just scrolls nowhere. `landing-anchors.test.tsx` holds it.
 */
const NAV_LINKS = [{ href: "/#how", key: "howItWorks" }] as const;

export function LandingNavbar() {
  const t = useTranslations("marketing.navbar");
  const { isAuthenticated } = useAuth();

  return (
    <header className="lp sticky top-0 z-50 border-b border-[var(--lp-line)] bg-[var(--lp-headbg)] backdrop-blur-[14px]">
      {/* The design is specified at desktop width; below `md` the control
          cluster no longer fits one line, so the bar wraps to two rows. */}
      <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center gap-x-2 gap-y-2 px-4 py-3 sm:gap-x-[22px] sm:px-8 md:h-[66px] md:flex-nowrap md:py-0">
        {/* A phone has 328px of row at 360px wide and the lockup at 32px takes
            139 of it, so it steps down to 24px below `sm` (104px). */}
        <Link href="/#top" className="flex flex-none items-center">
          <span className="sm:hidden">
            <BrandWordmark size={24} tagline />
          </span>
          <span className="hidden sm:block">
            <BrandWordmark size={32} tagline />
          </span>
        </Link>

        <nav className="hidden min-w-0 flex-auto items-center gap-4 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[14.5px] whitespace-nowrap text-[var(--lp-muted)]"
            >
              {t(link.key)}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5 whitespace-nowrap sm:gap-3 md:flex-nowrap">
          <LandingLangToggle />
          <LandingThemeToggle />
          {isAuthenticated ? (
            <Link
              href="/home"
              className="hidden text-[14.5px] text-[var(--lp-muted)] sm:block"
            >
              {t("openApp")}
            </Link>
          ) : (
            <SignedOutActions />
          )}
        </div>
      </div>
    </header>
  );
}

const LINK_CLASS = "hidden text-[14.5px] text-[var(--lp-muted)] sm:block";

/**
 * What the header offers somebody with no session.
 *
 * Below `sm` there is room for one control, and the client asked it to say
 * what it does: « Connexion / Inscription », straight to `/signin` (which has
 * « S'inscrire » at its top) — not the carrier flow's animation, which is for
 * the hero. It is two lines on purpose: on one line the label is 130px and the
 * header wrapped to a second row (client photo, 19 Nov). From `sm` up the two
 * doors are separate links and « Devenir transporteur » keeps its flow.
 *
 * Someone already signed in is not becoming a carrier from here — "Open app"
 * is the only CTA that still means anything, so it never reaches this.
 */
function SignedOutActions() {
  const t = useTranslations("marketing.navbar");

  return (
    <>
      <Link
        href="/signin"
        className={`${LP_BTN_PRIMARY} w-[5.5rem] flex-none whitespace-normal px-2 py-1.5 text-center text-[12px] leading-tight sm:hidden`}
      >
        {t("loginOrSignUp")}
      </Link>
      <Link href="/signin" className={LINK_CLASS}>
        {t("login")}
      </Link>
      <Link href="/signup" className={LINK_CLASS}>
        {t("signUp")}
      </Link>
      <LandingGatedButton
        intent="carrier"
        label={t("becomeCarrier")}
        className={`${LP_BTN_PRIMARY} hidden px-[18px] py-[9px] text-[14.5px] sm:block`}
      />
    </>
  );
}
