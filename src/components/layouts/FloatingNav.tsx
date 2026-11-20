"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface FloatingNavItem {
  href: string;
  label: string;
  icon: ReactNode;
  active: boolean;
  badge?: number;
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
 */
export const FLOATING_NAV_OUTER =
  "pointer-events-none fixed inset-x-0 bottom-0 z-50 px-2 pb-[calc(12px_+_env(safe-area-inset-bottom))] sm:px-4 xl:hidden";
export const FLOATING_NAV_CAPSULE =
  "pointer-events-auto mx-auto max-w-lg rounded-[30px] border border-white/40 bg-background/60 p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.16)] backdrop-blur-2xl backdrop-saturate-150 dark:border-white/10 dark:bg-background/50";

export function FloatingNav({
  items,
  ariaLabel,
}: {
  items: FloatingNavItem[];
  ariaLabel?: string;
}) {
  return (
    <nav aria-label={ariaLabel} className={FLOATING_NAV_OUTER}>
      <div className={cn(FLOATING_NAV_CAPSULE, "flex items-stretch gap-0.5")}>
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={cn(
              "relative flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[24px] px-0.5 py-1 transition-colors duration-200",
              // `bg-nav-active` is a plain colour with its own alpha
              // (globals.css). `bg-foreground/[0.08]` compiled to a solid
              // `var(--foreground)` with the tint in a `color-mix()` override,
              // and iOS Safari 15.4–16.1 has no `color-mix()`: the active item
              // was a near-black pill with a near-black label (2.91.0 #29).
              item.active
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
                // Two lines at most, broken between words; a single word too
                // long for the item breaks rather than disappearing. Below
                // 360px (the first iPhone SE) 12px no longer fits one word.
                "line-clamp-2 w-full text-center text-xs leading-[1.15] tracking-tight break-words max-[359px]:text-[11px]",
                item.active ? "font-semibold text-foreground" : "font-medium"
              )}
            >
              {item.label}
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
