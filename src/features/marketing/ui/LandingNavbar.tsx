"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState, type Ref } from "react";
import { useTranslations } from "next-intl";
import { Menu } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { BrandWordmark } from "@/components/ui/brand-mark";
import { useMenuDialog } from "../hooks/useMenuDialog";
import { LandingLangToggle, LandingThemeToggle } from "./LandingControls";
import { LandingMenu } from "./LandingMenu";
import { LP_BTN_PRIMARY } from "./styles";

/**
 * Anchors into the landing page. Every entry must name a section that page
 * still renders: « Courses » and « Plateforme » pointed at `#courses` and
 * `#platform` after both sections were cut (2.95.0), and a link to a missing
 * id just scrolls nowhere. `landing-anchors.test.tsx` holds it.
 */
const NAV_LINKS = [
  { href: "/#how", key: "howItWorks" },
  { href: "/#recent", key: "recent" },
  { href: "/#carriers", key: "carriers" },
] as const;

/**
 * Over the home page's hero the bar is glass; once the hero has scrolled
 * under it, it turns solid. Everywhere else it is solid from the start.
 * `false` on the server and the first render, so hydration agrees.
 */
function useSolidBar(overlay: boolean) {
  const [pastHero, setPastHero] = useState(false);

  useEffect(() => {
    const hero = overlay ? document.getElementById("top") : null;
    if (!hero || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setPastHero(!entry.isIntersecting),
      { rootMargin: "-88px 0px 0px 0px" }
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, [overlay]);

  return !overlay || pastHero;
}

const BAR =
  "mx-auto flex h-[64px] w-full max-w-[1240px] items-center gap-2 rounded-2xl px-3 ring-1 backdrop-blur-xl transition-[background-color,box-shadow] duration-300 sm:gap-3 sm:px-5";

const GLASS =
  "bg-[rgb(255_255_255/0.86)] ring-[rgb(255_255_255/0.55)] shadow-[0_12px_34px_-16px_rgba(2,12,32,0.5)] dark:bg-[rgb(8_22_48/0.62)] dark:ring-[rgb(255_255_255/0.12)]";

const SOLID =
  "bg-[rgb(255_255_255/0.96)] ring-[rgb(12_28_56/0.1)] shadow-[0_14px_34px_-20px_rgba(7,40,90,0.45)] dark:bg-[rgb(9_24_52/0.95)] dark:ring-[rgb(143_184_255/0.14)]";

/** A phone has ~300px of bar at 360px wide; the lockup steps down to 24px
    below `sm` so the one sign-in door and the menu still fit. */
function BarLogo() {
  return (
    <Link href="/#top" className="flex flex-none items-center">
      <span className="sm:hidden">
        <BrandWordmark size={24} tagline />
      </span>
      <span className="hidden sm:block">
        <BrandWordmark size={28} tagline />
      </span>
    </Link>
  );
}

/**
 * From `xl` only: below it the doors on the right need the room. The third
 * link is where « Devenir transporteur » lives for a visitor with no session
 * (2.98.0): it was a third button on the right, and the bar keeps two.
 */
function BarLinks({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations("marketing.navbar");
  return (
    <nav className="hidden min-w-0 flex-auto items-center justify-center gap-6 xl:flex">
      {NAV_LINKS.map((link) => (
        <Link key={link.href} href={link.href} className="text-[14.5px] font-medium whitespace-nowrap text-[var(--lp-muted)]">
          {t(link.key === "carriers" && !signedIn ? "becomeCarrier" : link.key)}
        </Link>
      ))}
    </nav>
  );
}

function MenuButton({
  open,
  menuId,
  triggerRef,
  onOpen,
}: {
  open: boolean;
  menuId: string;
  triggerRef: Ref<HTMLButtonElement>;
  onOpen: () => void;
}) {
  const t = useTranslations("marketing.navbar");
  return (
    <button
      ref={triggerRef}
      type="button"
      onClick={onOpen}
      aria-expanded={open}
      aria-controls={open ? menuId : undefined}
      aria-label={t("menuOpen")}
      className="flex h-10 w-10 flex-none cursor-pointer items-center justify-center rounded-xl border-0 bg-transparent text-[var(--lp-text)] transition-colors hover:bg-[var(--lp-chip)]"
    >
      <Menu className="h-[22px] w-[22px]" aria-hidden />
    </button>
  );
}

/**
 * The marketing header, floating inset from the edges (2.97.0, after the
 * reference's): the wordmark, the session's doors, and a three-line button
 * that opens the full-screen menu. `overlay` — the home page only — fixes it
 * over the full-bleed hero; the other marketing pages keep it in the flow,
 * sticky, so their content starts below it.
 *
 * `lp` for the palette; its own background is cleared inline, since `.lp`
 * (unlayered) paints one and the inset bar is the only surface here.
 */
export function LandingNavbar({ overlay = false }: { overlay?: boolean }) {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const { panelRef, triggerRef } = useMenuDialog(open, close);
  const solid = useSolidBar(overlay);
  const menuId = useId();

  return (
    <header
      className={cn("lp z-50 px-2.5 pt-2.5 font-sans sm:px-4 sm:pt-3", overlay ? "fixed inset-x-0 top-0" : "sticky top-0")}
      style={{ background: "transparent" }}
    >
      <div data-solid={solid} className={cn(BAR, solid ? SOLID : GLASS)}>
        <BarLogo />
        <BarLinks signedIn={isAuthenticated} />
        <div className="ml-auto flex items-center gap-1.5 whitespace-nowrap sm:gap-3">
          {/* The two preferences sit in the bar from `lg`; below it they are
              in the menu, which every width can open. */}
          <span className="hidden items-center gap-2 lg:flex">
            <LandingLangToggle />
            <LandingThemeToggle />
          </span>
          {isAuthenticated ? <SignedInAction /> : <SignedOutActions />}
          <MenuButton open={open} menuId={menuId} triggerRef={triggerRef} onOpen={() => setOpen(true)} />
        </div>
      </div>
      {open && <LandingMenu id={menuId} panelRef={panelRef} onClose={close} />}
    </header>
  );
}

/** Someone already signed in has one thing to do from here: go in. */
function SignedInAction() {
  const t = useTranslations("marketing.navbar");
  return (
    <Link href="/home" className={`${LP_BTN_PRIMARY} px-3.5 py-2 text-[14px]`}>
      {t("openApp")}
    </Link>
  );
}

/**
 * What the header offers somebody with no session: two doors, never more.
 *
 * Below `sm` there is room for one control, and the client asked it to say
 * what it does: « Connexion / Inscription », straight to `/signin` (which has
 * « S'inscrire » at its top). It is two lines on purpose: on one line the
 * label is 130px and the bar ran out of room (client photo, 19 Nov). From
 * `sm` up it is « Connexion » as a link and « Inscription » as the one filled
 * button. « Devenir transporteur » is in the bar's links and in the menu.
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
      <Link href="/signin" className="hidden px-1 text-[14.5px] font-medium text-[var(--lp-muted)] sm:block">
        {t("login")}
      </Link>
      <Link href="/signup" className={`${LP_BTN_PRIMARY} hidden px-4 py-[9px] text-[14.5px] sm:block`}>
        {t("signUp")}
      </Link>
    </>
  );
}
