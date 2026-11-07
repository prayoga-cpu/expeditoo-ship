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
  /** Replaces the plain navigation (a dialog, a mode flip first). */
  onSelect?: () => void;
}

/**
 * The shared look of every phone navigation bar: a floating, rounded, frosted
 * capsule that hovers above the content, after the new iOS tab bar.
 *
 * Height budget: the capsule is ~64px plus 12px of air plus the safe area, which
 * stays inside the `88px + env(safe-area-inset-bottom)` the shells already
 * reserve under `<main>`, so nothing needed to move. The outer `nav` ignores
 * pointer events so the strip beside the capsule does not swallow taps.
 */
export const FLOATING_NAV_OUTER =
  "pointer-events-none fixed inset-x-0 bottom-0 z-50 px-4 pb-[calc(12px_+_env(safe-area-inset-bottom))] xl:hidden";
export const FLOATING_NAV_CAPSULE =
  "pointer-events-auto mx-auto max-w-md rounded-[30px] border border-white/40 bg-background/60 p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.16)] backdrop-blur-2xl backdrop-saturate-150 dark:border-white/10 dark:bg-background/50";

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
            onClick={
              item.onSelect
                ? (e) => {
                    e.preventDefault();
                    item.onSelect!();
                  }
                : undefined
            }
            className={cn(
              "relative flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[24px] px-1 py-1.5 transition-colors duration-200",
              item.active
                ? "bg-foreground/[0.08] text-primary"
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
                "w-full truncate text-center text-[10px] leading-tight",
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
