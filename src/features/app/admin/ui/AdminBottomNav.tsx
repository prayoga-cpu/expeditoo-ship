"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useEffect } from "react";
import { badgeFor } from "../nav";
import { cn } from "@/lib/utils";
import {
  FLOATING_NAV_CAPSULE,
  FLOATING_NAV_LABEL,
  FLOATING_NAV_OUTER,
} from "@/components/layouts/FloatingNav";
import { NAV_PRESS, usePendingNav } from "@/components/layouts/use-pending-nav";
import { useTranslations } from "next-intl";
import { useAdminNav } from "../hooks/useAdminNav";

/**
 * Whether this entry owns the current path.
 *
 * A bare `startsWith` lit two tabs at once the moment a route became the prefix
 * of another: `/admin/expedion-clients` starts with `/admin/expedion`, so both
 * read as active and the auto-scroll centred on whichever came last. Matching
 * the segment boundary keeps `/admin/users/123` under `/admin/users` without
 * making `/admin/expedion` claim its neighbour.
 */
function isCurrent(pathname: string | null, href: string) {
  return pathname === href || Boolean(pathname?.startsWith(`${href}/`));
}

export function AdminBottomNav() {
  const pathname = usePathname();
  const t = useTranslations("admin.navigation");
  const { groups, counts } = useAdminNav();
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);
  const { pendingHref, onNavigate } = usePendingNav();

  // The same groups as the sidebar, flattened: one list, so a page cannot be
  // reachable on a desktop and not on a phone — and filtered by the same
  // roles, so a phone offers no entry the proxy would bounce.
  const navItems = groups.flatMap((group) => group.items).map((entry) => ({
    href: entry.href,
    label: t(entry.labelKey),
    icon: <entry.icon className="w-5 h-5" />,
    badge: badgeFor(counts, entry),
  }));

  // Auto-scroll to active item on mount
  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const activeItem = activeRef.current;
      const containerWidth = container.offsetWidth;
      const itemLeft = activeItem.offsetLeft;
      const itemWidth = activeItem.offsetWidth;
      
      // Center the active item in the viewport
      const scrollPosition = itemLeft - (containerWidth / 2) + (itemWidth / 2);
      container.scrollTo({ left: scrollPosition, behavior: "smooth" });
    }
  }, [pathname]);

  return (
    <nav aria-label={t("bottomLabel")} className={FLOATING_NAV_OUTER}>
      <div 
        ref={scrollRef}
        role="menubar"
        aria-label={t("bottomMenu")}
        className={cn(FLOATING_NAV_CAPSULE, "flex overflow-x-auto scrollbar-hide scroll-smooth sm:justify-center")}
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {navItems.map((item) => {
          const isActive = isCurrent(pathname, item.href);
          const badge = item.badge;
          // Lit at once on a tap, before the route answers (use-pending-nav.ts).
          const lit = pendingHref ? pendingHref === item.href : isActive;
          return (
            <Link
              key={item.href}
              href={item.href}
              ref={isActive ? activeRef : undefined}
              role="menuitem"
              aria-current={isActive ? "page" : undefined}
              data-pending={pendingHref === item.href ? "" : undefined}
              onClick={(event) => onNavigate(event, item.href, isActive)}
              className={cn(
                // A fixed width, not a minimum: the label wraps to a second
                // line inside it instead of stretching the item, the same
                // 12px / two-line rule as FloatingNav (2.91.0 #4/#28) — this
                // bar was left at 10px on one line. The icon lost its padded
                // tile so the two lines stay inside the 88px the shell
                // reserves: 20 + 2 + 28 + 8, in a capsule with 6px of padding.
                "relative flex min-h-14 w-[76px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-[24px] px-1 py-1 transition-[color,background-color,transform] duration-200",
                NAV_PRESS,
                lit
                  ? "bg-nav-active text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="relative">
                {item.icon}
                {badge ? (
                  <span
                    className="absolute -top-1.5 -right-2 bg-destructive text-white text-[10px] font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center shadow-sm tabular-nums"
                    aria-hidden
                  >
                    {badge > 9 ? "9+" : badge}
                  </span>
                ) : null}
              </div>

              {badge ? <span className="sr-only">{badge}</span> : null}

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
      
      {/* Fade indicators for scroll hint */}
      <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-background to-transparent pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-background to-transparent pointer-events-none" />
    </nav>
  );
}

