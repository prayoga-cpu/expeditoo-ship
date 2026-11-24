"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { NAV_PRESS, usePendingNav } from "./use-pending-nav";

export interface FloatingNavItem {
  href: string;
  label: string;
  icon: ReactNode;
  active: boolean;
  badge?: number;
}

/**
 * A place held for an item that depends on the session's roles, while they
 * load (2.96.0 #36). The bar renders from the server's HTML now, before the
 * session is known; filling a slot later moves nothing, where swapping one
 * set of five links for another put a different page under a finger that was
 * already on its way down.
 */
export interface FloatingNavSlot {
  placeholder: true;
  key: string;
}

export type FloatingNavEntry = FloatingNavItem | FloatingNavSlot;

const isSlot = (entry: FloatingNavEntry): entry is FloatingNavSlot =>
  "placeholder" in entry;

/** What an unfilled slot draws: the item's own box, an icon and a label's
 * worth of muted shape, and nothing to press. */
function NavSlot() {
  return (
    <span
      aria-hidden
      data-nav-slot=""
      className="flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1.5 px-0.5 py-1"
    >
      <span className="h-5 w-5 rounded-md bg-muted motion-safe:animate-pulse" />
      <span className="h-2.5 w-10 max-w-[80%] rounded-full bg-muted motion-safe:animate-pulse" />
    </span>
  );
}

/**
 * The shared look of every phone navigation bar: a floating, rounded, frosted
 * capsule that hovers above the content, after the new iOS tab bar.
 *
 * Height budget: the capsule is ~70px (74px when a label takes two lines) plus
 * 12px of air plus the safe area, which stays inside the
 * `88px + env(safe-area-inset-bottom)` the shells already reserve under
 * `<main>`, so nothing needed to move. The outer `nav` ignores pointer events
 * so the strip beside the capsule does not swallow taps.
 *
 * Width budget (2.91.0 #4/#28): labels were 10px and still ended on « … » —
 * five items share the capsule, and on a 390px phone each had ~55px of text.
 * Labels are 12px now, so the capsule takes the room back from its own
 * margins: 8px of gutter on a phone instead of 16px, 2px of item padding
 * instead of 4px — ~66px of text per item at 390px, ~60px at 360px. That fits
 * one word of about eight letters, which is why the bars carry their own
 * short labels (`common.navigation.bar.*`), and a two-word label wraps to a
 * second line instead of being cut.
 *
 * The bar belongs to phones and tablets: from `lg` the sidebar takes over, as
 * a rail on a small laptop (2.92.0 #17). It used to stay until `xl`, which put
 * a phone's tab bar on a 1024–1279px laptop.
 */
export const FLOATING_NAV_OUTER =
  "pointer-events-none fixed inset-x-0 bottom-0 z-50 px-2 pb-[calc(12px_+_env(safe-area-inset-bottom))] sm:px-4 lg:hidden";
/** The label under an icon: 12px, two lines at most, broken between words; a
 * single word too long for the item breaks rather than disappearing. Below
 * 360px (the first iPhone SE) 12px no longer fits one word. */
export const FLOATING_NAV_LABEL =
  "line-clamp-2 w-full text-center text-xs leading-[1.15] tracking-tight break-words max-[359px]:text-[11px]";
export const FLOATING_NAV_CAPSULE =
  "pointer-events-auto mx-auto max-w-lg rounded-[30px] border border-white/40 bg-background/60 p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.16)] backdrop-blur-2xl backdrop-saturate-150 dark:border-white/10 dark:bg-background/50";

export function FloatingNav({
  items,
  ariaLabel,
}: {
  items: FloatingNavEntry[];
  ariaLabel?: string;
}) {
  const { pendingHref, onNavigate } = usePendingNav();

  return (
    <nav aria-label={ariaLabel} className={FLOATING_NAV_OUTER}>
      <div className={cn(FLOATING_NAV_CAPSULE, "flex items-stretch gap-0.5")}>
        {items.map((item) => {
          if (isSlot(item)) return <NavSlot key={item.key} />;
          // The tapped item reads as current while its page is on the way
          // (use-pending-nav.ts); `aria-current` keeps telling the truth.
          const lit = pendingHref ? pendingHref === item.href : item.active;
          return (
          <Link
            key={item.href}
            href={item.href}
            // The whole route, not just its loading shell: the tap should
            // land on a page, not on a spinner (2.96.0 #36).
            prefetch
            aria-current={item.active ? "page" : undefined}
            data-pending={pendingHref === item.href ? "" : undefined}
            onClick={(event) => onNavigate(event, item.href, item.active)}
            className={cn(
              "relative flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[24px] px-0.5 py-1 transition-[color,background-color,transform] duration-200",
              NAV_PRESS,
              // `bg-nav-active` is a plain colour with its own alpha
              // (globals.css). `bg-foreground/[0.08]` compiled to a solid
              // `var(--foreground)` with the tint in a `color-mix()` override,
              // and iOS Safari 15.4–16.1 has no `color-mix()`: the active item
              // was a near-black pill with a near-black label (2.91.0 #29).
              lit
                ? "bg-nav-active text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="relative">
              {item.icon}
              {item.badge ? (
                <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white shadow-sm">
                  {item.badge}
                </span>
              ) : null}
            </span>
            <span
              className={cn(
                FLOATING_NAV_LABEL,
                lit ? "font-semibold text-foreground" : "font-medium"
              )}
            >
              {item.label}
            </span>
          </Link>
          );
        })}
      </div>
    </nav>
  );
}
