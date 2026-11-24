"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Menu, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  RAIL,
  SIDEBAR_ID,
  type SidebarRail,
  type SidebarRailState,
} from "./use-sidebar-rail";

/**
 * The sidebar of all three shells (app, driver, admin): one `<aside>`, one
 * toggle and one link, so the rail is drawn once (2.92.0 #17). What goes in
 * the list stays each shell's business.
 *
 * `overflow-hidden` and `shrink-0` are what keep the width change from ever
 * reaching the page: the column beside it is `flex-1` and simply takes what is
 * left, and `<main>` inside that stays the only scroller.
 */
export function AppSidebar({
  state,
  children,
}: {
  state: SidebarRailState;
  children: ReactNode;
}) {
  return (
    <aside
      id={SIDEBAR_ID}
      data-rail={state}
      className={cn(
        "group/sidebar hidden shrink-0 flex-col overflow-hidden border-r bg-card lg:flex",
        "transition-[width] duration-200 motion-reduce:transition-none",
        RAIL.aside
      )}
    >
      {children}
    </aside>
  );
}

/** The header's three-line button. Absent below `lg`, where there is no sidebar. */
export function SidebarToggle({ rail }: { rail: SidebarRail }) {
  const t = useTranslations("common.sidebar");
  const label = rail.expanded ? t("collapse") : t("expand");

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="hidden h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground lg:inline-flex"
      aria-label={label}
      title={label}
      aria-expanded={rail.expanded}
      aria-controls={SIDEBAR_ID}
      onClick={rail.toggle}
    >
      <Menu className="h-4 w-4" />
    </Button>
  );
}

const DEFAULT_TONE = {
  active: "bg-primary text-primary-foreground",
  idle: "text-muted-foreground hover:bg-muted hover:text-foreground",
};

/**
 * One destination. In the rail the label is kept for screen readers rather
 * than removed, so the link keeps its name, and `title` gives a mouse the
 * tooltip. Whatever rides at the end of the row — a count, a status — comes in
 * as children and decides for itself how it survives the rail (`RAIL.badge`,
 * `RAIL.srOnly`).
 */
export function SidebarLink({
  href,
  label,
  icon: Icon,
  active,
  tone = DEFAULT_TONE,
  dense = false,
  onSelect,
  children,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  tone?: { active: string; idle: string };
  /** The admin list is longer and sets its rows closer. */
  dense?: boolean;
  /** Replaces the plain navigation. */
  onSelect?: () => void;
  children?: ReactNode;
}) {
  return (
    <Link
      href={href}
      // The whole route ahead of the click, not just its loading shell
      // (2.96.0 #36). Only while the sidebar is on screen; below `lg` the
      // shell's `useNavPrefetch` covers these destinations.
      prefetch
      title={label}
      aria-current={active ? "page" : undefined}
      onClick={
        onSelect
          ? (e) => {
              e.preventDefault();
              onSelect();
            }
          : undefined
      }
      className={cn(
        "relative flex items-center gap-3 rounded-lg px-4 text-sm font-medium transition-colors",
        dense ? "py-2.5" : "py-3",
        RAIL.center,
        active ? tone.active : tone.idle
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className={cn("min-w-0 flex-1", RAIL.srOnly)}>{label}</span>
      {children}
    </Link>
  );
}

/**
 * A row held for entries that depend on the session's roles, while it loads
 * (2.96.0 #36). Same box as `SidebarLink`, nothing to press, so the list is
 * drawn from the server's HTML and its stable entries never move.
 */
export function SidebarLinkSlot({ dense = false }: { dense?: boolean }) {
  return (
    <span
      aria-hidden
      data-nav-slot=""
      className={cn(
        "flex items-center gap-3 rounded-lg px-4",
        dense ? "py-2.5" : "py-3",
        RAIL.center
      )}
    >
      <span className="h-5 w-5 shrink-0 rounded-md bg-muted motion-safe:animate-pulse" />
      <span
        className={cn(
          "h-3 w-28 max-w-full rounded-full bg-muted motion-safe:animate-pulse",
          RAIL.hidden
        )}
      />
    </span>
  );
}

/** A group's heading; in the rail, a rule where the heading was. */
export function SidebarHeading({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <>
      <p
        className={cn(
          "px-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70",
          className,
          RAIL.hidden
        )}
      >
        {children}
      </p>
      <span aria-hidden className={cn("mx-2 h-px bg-border", RAIL.only)} />
    </>
  );
}
