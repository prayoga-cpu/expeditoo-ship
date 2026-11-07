"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useEffect } from "react";
import { ADMIN_NAV_GROUPS, badgeFor } from "../nav";
import { cn } from "@/lib/utils";
import { FLOATING_NAV_CAPSULE, FLOATING_NAV_OUTER } from "@/components/layouts/FloatingNav";
import { useTranslations } from "next-intl";
import { useAdminNavCounts } from "../hooks/useAdminNavCounts";

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
  const counts = useAdminNavCounts();
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);

  // The same groups as the sidebar, flattened: one list, so a page cannot be
  // reachable on a desktop and not on a phone.
  const navItems = ADMIN_NAV_GROUPS.flatMap((group) => group.items).map((entry) => ({
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
    <nav aria-label="Admin navigation" className={FLOATING_NAV_OUTER}>
      <div 
        ref={scrollRef}
        role="menubar"
        aria-label="Admin menu - scroll horizontally for more options"
        className={cn(FLOATING_NAV_CAPSULE, "flex overflow-x-auto scrollbar-hide scroll-smooth sm:justify-center")}
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {navItems.map((item) => {
          const isActive = isCurrent(pathname, item.href);
          const badge = item.badge;
          return (
            <Link
              key={item.href}
              href={item.href}
              ref={isActive ? activeRef : undefined}
              role="menuitem"
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2 px-3 min-w-[68px] min-h-14 rounded-[24px] transition-all duration-200 relative group shrink-0",
                isActive
                  ? "bg-foreground/[0.08] text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div
                className={cn(
                  "relative p-1.5 rounded-lg transition-all duration-200",
                  isActive ? "bg-primary/10" : "group-hover:bg-muted"
                )}
              >
                {item.icon}
                {badge ? (
                  <span
                    className="absolute -top-1 -right-1 bg-destructive text-white text-[10px] font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center shadow-sm tabular-nums"
                    aria-hidden
                  >
                    {badge > 9 ? "9+" : badge}
                  </span>
                ) : null}
              </div>

              {badge ? <span className="sr-only">{badge}</span> : null}

              <span
                className={cn(
                  "text-[10px] font-medium transition-all duration-200 whitespace-nowrap",
                  isActive
                    ? "text-foreground font-semibold"
                    : "text-muted-foreground"
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

