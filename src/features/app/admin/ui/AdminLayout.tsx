"use client";

import { useEffect } from "react";
import { NotificationBell } from "@/components/NotificationBell";
import { HeaderToolbox } from "@/components/layouts/HeaderToolbox";
import { AppVersionLink } from "@/components/ui/app-version";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ADMIN_NAV_GROUPS, badgeFor } from "../nav";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AdminBottomNav } from "./AdminBottomNav";
import { AppSidebarHeader } from "@/components/layouts/AppSidebarHeader";
import { HeaderAccount } from "@/components/layouts/HeaderAccount";
import { useAdminNavCounts } from "../hooks/useAdminNavCounts";
import type { AdminNavCounts } from "@/server/services/admin-nav.service";
import { useTranslations } from "next-intl";
import { useActiveAccessMode } from "@/lib/use-active-access-mode";

interface AdminLayoutProps {
  children: React.ReactNode;
}

/**
 * Which badge each entry wears.
 *
 * `attention` is work waiting on staff and is loud; `info` is how much is
 * simply there — new signups, open listings, shipments in flight — and stays
 * quiet. The distinction is the whole point: an operator who cannot tell the
 * two apart at a glance stops reading either. Entries absent from this map get
 * no badge, because nothing about them is ever waiting on anyone.
 */
const BADGE_TONE: Record<keyof AdminNavCounts, "attention" | "info"> = {
  expedion: "attention",
  awards: "attention",
  applications: "attention",
  drivers: "attention",
  payments: "attention",
  support: "attention",
  feedback: "attention",
  users: "info",
  listings: "info",
  shipments: "info",
};

export function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const counts = useAdminNavCounts();
  const { mode, qualifiedModes, setMode } = useActiveAccessMode();

  // Reaching this layout at all means the session is browsing the back
  // office. The switcher badge is only a client-side preference on top of
  // the session's real roles (active-access.ts) — nothing here grants
  // access — but a stale "User" badge while the sidebar and every page on
  // screen is the admin panel is confusing, and it happens whenever someone
  // lands here without going through the switcher (a bookmark, the sign-in
  // redirect, the sidebar's "Admin Panel" link). Force it to agree with
  // where they actually are, the same way MainLayout redirects away from
  // this layout's routes when the stored mode is stale in the other
  // direction.
  //
  // Deliberately empty deps: this corrects a *stale* mode once, on mount.
  // Re-running it on every `mode` change would fight any *intentional* switch
  // away from admin made while this layout is still mounted mid-navigation —
  // the switcher's and the Back button's own `setMode` calls both need a
  // render or two before the route actually changes, and this effect was
  // winning that race, silently undoing the switch before `MainLayout` ever
  // saw the new mode.
  useEffect(() => {
    if (mode !== "admin") setMode("admin");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBack = () => {
    setMode(qualifiedModes.find((candidate) => candidate !== "admin") ?? "user");
    router.push("/profile");
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full pb-4">
      {/* No subtitle: the content header already reads "Admin Panel", and the
          two sat one above the other. */}
      <AppSidebarHeader href="/admin/expedion" />
      {/* p-4, not px-4: the removed subtitle's bottom padding had been standing
          in for the gap under the logo. Matches the app sidebar. */}
      <nav className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {ADMIN_NAV_GROUPS.map((group) => (
          <div key={group.id} className="space-y-1" role="group" aria-label={t(`navigation.groups.${group.labelKey}`)}>
            <p className="px-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
              {t(`navigation.groups.${group.labelKey}`)}
            </p>
            {group.items.map((item) => {
              const active =
                pathname === item.href || Boolean(pathname?.startsWith(`${item.href}/`));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="flex-1">{t(`navigation.${item.labelKey}`)}</span>
                  <NavBadge
                    count={badgeFor(counts, item)}
                    tone={item.badges ? BADGE_TONE[item.badges[0]] : "info"}
                    active={active}
                  />
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </div>
  );

  return (
    <div
      className="flex h-screen bg-background"
      style={
        {
          "--loader-offset-mobile": "8.5rem", // Header (3rem) + Nav (5.5rem)
          "--loader-offset-desktop": "7rem", // Header + Padding buffer
        } as React.CSSProperties
      }
    >
      {/* Desktop Sidebar - Static like MainLayout */}
      <aside className="hidden xl:flex w-64 shrink-0 overflow-hidden border-r bg-card flex-col">
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header - Always visible like MainLayout */}
        <header className="border-b border-border bg-card shrink-0 z-40">
          <div className="flex items-center justify-between px-4 md:px-6 py-2 h-12">
            <div className="flex min-w-0 items-center gap-3">
              <h1 className="text-lg font-bold text-foreground">
                {t("panelTitle")}
              </h1>
              <AppVersionLink className="hidden md:inline-flex" />
            </div>
            <div className="flex items-center gap-2">
              {/* The sidebar no longer carries its own "Back to App" — this is
                  the only way out now, at every width, not just below xl.
                  A plain `Link` used to leave `mode` at "admin", so
                  `MainLayout`'s own guard sent `/profile` straight back here
                  before the click ever registered as working. */}
              <Button variant="ghost" size="sm" className="gap-2" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4" />
                {tCommon("buttons.back")}
              </Button>
              <HeaderToolbox />
              <NotificationBell />
              <HeaderAccount profileHref="/admin/profile" />
            </div>
          </div>
        </header>

        {/* Content Area - Wrapper provides consistent padding. `relative`
            keeps absolutely positioned descendants inside this scroller — see
            MainLayout, where their escape showed up as a second scrollbar. */}
        <main
          className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-[calc(88px_+_env(safe-area-inset-bottom))] xl:pb-0 overscroll-contain"
          style={{ scrollbarGutter: "stable" }}
        >
          <div className="p-4 md:p-6">{children}</div>
        </main>

        {/* Mobile Bottom Nav - INSIDE flex-col like MainLayout */}
        <AdminBottomNav />
      </div>
    </div>
  );
}

/**
 * A count on a nav entry, or nothing at all.
 *
 * Zero renders nothing rather than a "0" pill: an empty queue is the normal
 * state, and a row of noughts is nine pieces of furniture the eye has to skip
 * before finding the one number that matters. The count is also spoken —
 * `aria-hidden` on the pill with an `sr-only` phrase beside it — because "12"
 * announced on its own after a link label tells a screen-reader user nothing.
 */
function NavBadge({
  count,
  tone,
  active,
}: {
  count?: number;
  tone: "attention" | "info";
  active: boolean;
}) {
  if (!count) return null;

  return (
    <span className="flex items-center">
      <span
        aria-hidden
        className={cn(
          "min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-semibold tabular-nums",
          active
            ? "bg-primary-foreground/20 text-primary-foreground"
            : tone === "attention"
              ? "bg-destructive text-white"
              : "bg-muted-foreground/15 text-muted-foreground"
        )}
      >
        {count > 99 ? "99+" : count}
      </span>
      <span className="sr-only">{count}</span>
    </span>
  );
}
