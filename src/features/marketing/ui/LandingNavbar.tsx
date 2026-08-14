"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { BrandWordmark } from "@/components/ui/brand-mark";
import { LandingLangToggle, LandingThemeToggle } from "./LandingControls";
import { LP_BTN_PRIMARY } from "./styles";

const NAV_LINKS = [
  { href: "/#how", key: "howItWorks" },
  { href: "/#courses", key: "jobs" },
  { href: "/#platform", key: "platform" },
] as const;

export function LandingNavbar() {
  const t = useTranslations("marketing.navbar");
  const { isAuthenticated } = useAuth();

  return (
    <header className="lp sticky top-0 z-50 border-b border-[var(--lp-line)] bg-[var(--lp-headbg)] backdrop-blur-[14px]">
      {/* The design is specified at desktop width; below `md` the control
          cluster no longer fits one line, so the bar wraps to two rows. */}
      <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center gap-x-[22px] gap-y-2 px-5 py-3 sm:px-8 md:h-[66px] md:flex-nowrap md:py-0">
        <Link href="/#top" className="flex flex-none items-center">
          <BrandWordmark size={32} />
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

        <div className="ml-auto flex flex-wrap items-center justify-end gap-3 whitespace-nowrap md:flex-nowrap">
          <LandingLangToggle />
          <LandingThemeToggle />
          <Link
            href={isAuthenticated ? "/home" : "/signin"}
            className="hidden text-[14.5px] text-[var(--lp-muted)] sm:block"
          >
            {isAuthenticated ? t("openApp") : t("login")}
          </Link>
          <Link
            href="/signup"
            className={`${LP_BTN_PRIMARY} px-[18px] py-[9px] text-[14.5px]`}
          >
            {t("becomeCarrier")}
          </Link>
        </div>
      </div>
    </header>
  );
}
