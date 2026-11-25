"use client";

import { NotificationBell } from "@/components/NotificationBell";
import { HeaderToolbox } from "@/components/layouts/HeaderToolbox";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  User,
  ArrowLeft,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DriverBottomNav } from "./DriverBottomNav";
import { AppSidebarHeader } from "@/components/layouts/AppSidebarHeader";
import { HeaderAccount } from "@/components/layouts/HeaderAccount";
import { AccessSwitcher } from "@/components/layouts/AccessSwitcher";
import { AppSidebar, SidebarLink, SidebarToggle } from "@/components/layouts/SidebarRail";
import { RAIL, WHEN_RAIL, useSidebarRail } from "@/components/layouts/use-sidebar-rail";
import { useNavPrefetch } from "@/components/layouts/use-nav-prefetch";
import { AppVersionLink } from "@/components/ui/app-version";
import { useTranslations } from "next-intl";
import { useActiveAccessMode } from "@/lib/use-active-access-mode";

interface DriverLayoutProps {
  children: React.ReactNode;
}



export function DriverLayout({ children }: DriverLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("driver");
  const tCommon = useTranslations("common");
  const { qualifiedModes, setMode } = useActiveAccessMode();
  const rail = useSidebarRail();
  const hideBottomNav = pathname?.startsWith("/driver/shipments/");

  // Same fix as AdminLayout's Back button: an account that also holds admin
  // (or another staff role) can land here with `mode` still "admin" from an
  // earlier admin-panel visit — `/profile` is a MainLayout route, and
  // MainLayout bounces straight back to `/admin/expedion` whenever `mode`
  // is "admin", so a plain `Link` silently did nothing for that account.
  const handleBack = () => {
    setMode(qualifiedModes.find((candidate) => candidate !== "admin") ?? "user");
    router.push("/profile");
  };

  const sidebarItems = [
    {
      title: t("navigation.dashboard"),
      href: "/driver/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: t("navigation.shipments"),
      href: "/driver/shipments",
      icon: Package,
    },
    {
      title: t("navigation.messages"),
      href: "/driver/messages",
      icon: MessageSquare,
    },
    {
      title: t("navigation.profile"),
      href: "/driver/profile",
      icon: User,
    },
  ];

  // The whole route ahead of a tap, for the bar's destinations too
  // (2.96.0 #36). Static: this shell's entries do not depend on the session.
  useNavPrefetch(sidebarItems.map((item) => item.href));

  // An element, not a component declared in here: a component defined inside
  // render is a new type on every render, so React rebuilt the whole sidebar
  // each time this layout re-rendered, and a click whose press and release
  // straddled a rebuild never fired (2.96.0 #36).
  const sidebarContent = (
    <div className="flex flex-col h-full pb-4">
      {/* Same as the admin sidebar: the content header already carries the
          panel title, so a subtitle here just repeated it. */}
      <AppSidebarHeader />
      {/* p-4, not px-4: same as the admin sidebar — its subtitle used to supply
          the gap under the logo. Matches the app sidebar. */}
      <nav className={cn("flex-1 min-h-0 overflow-y-auto p-4 space-y-2", RAIL.gutter)}>
        {sidebarItems.map((item) => (
          <SidebarLink
            key={item.href}
            href={item.href}
            label={item.title}
            icon={item.icon}
            active={
              pathname === item.href ||
              (item.href !== "/driver/dashboard" && Boolean(pathname?.startsWith(item.href)))
            }
          />
        ))}
      </nav>
      <div className={cn("px-4 mt-auto", RAIL.gutter)}>
        <Button
          variant="outline"
          className={cn("w-full justify-start gap-2", RAIL.center)}
          title={tCommon("navigation.backToApp")}
          onClick={handleBack}
        >
          <ArrowLeft className="w-4 h-4" />
          <span className={RAIL.srOnly}>{tCommon("navigation.backToApp")}</span>
        </Button>
      </div>
    </div>
  );

  return (
    <div 
      className="flex h-screen bg-background"
      style={{
        '--loader-offset-mobile': '8.5rem', // Header (3rem) + Nav (5.5rem)
        '--loader-offset-desktop': '7rem',  // Header + Padding buffer
      } as React.CSSProperties}
    >
      {/* Desktop Sidebar - Static like MainLayout */}
      <AppSidebar state={rail.state}>{sidebarContent}</AppSidebar>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header - Always visible like MainLayout */}
        <header className="border-b border-border bg-card sticky top-0 z-40">
          <div className="flex items-center justify-between px-4 md:px-6 py-2 h-12">
            <div className="flex min-w-0 items-center gap-3">
              <SidebarToggle rail={rail} />
              <h1 className="text-lg font-bold text-foreground">{t("panelTitle")}</h1>
              {/* The sidebar's switcher does not fit a rail; it rides here
                  while the sidebar is one. */}
              <AccessSwitcher className={WHEN_RAIL.sidebarOnly[rail.state]} />
              <AppVersionLink className="hidden md:inline-flex" />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="gap-2" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4" />
                {tCommon("buttons.back")}
              </Button>
              <HeaderToolbox />
              <NotificationBell />
              <HeaderAccount profileHref="/driver/profile" />
            </div>
          </div>
        </header>

        {/* Content Area - Wrapper provides consistent padding. `relative`
            keeps absolutely positioned descendants inside this scroller — see
            MainLayout, where their escape showed up as a second scrollbar. */}
        <main
          className={cn(
            "relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden lg:pb-0",
            !hideBottomNav && "pb-[calc(88px_+_env(safe-area-inset-bottom))]"
          )}
          style={{ scrollbarGutter: "stable" }}
        >
          <div className="p-4 md:p-6">{children}</div>
        </main>

        {/* Mobile Bottom Nav - INSIDE flex-col like MainLayout */}
        {!hideBottomNav && <DriverBottomNav />}
      </div>
    </div>
  );
}
