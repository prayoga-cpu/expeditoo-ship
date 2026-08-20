"use client";

import { NotificationBell } from "@/components/NotificationBell";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
import { useTranslations } from "next-intl";

interface DriverLayoutProps {
  children: React.ReactNode;
}



export function DriverLayout({ children }: DriverLayoutProps) {
  const pathname = usePathname();
  const t = useTranslations("driver");
  const tCommon = useTranslations("common");
  const hideBottomNav = pathname?.startsWith("/driver/shipments/");

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

  const SidebarContent = () => (
    <div className="flex flex-col h-full pb-4">
      {/* Same as the admin sidebar: the content header already carries the
          panel title, so a subtitle here just repeated it. */}
      <AppSidebarHeader href="/driver/dashboard" />
      {/* p-4, not px-4: same as the admin sidebar — its subtitle used to supply
          the gap under the logo. Matches the app sidebar. */}
      <nav className="flex-1 p-4 space-y-2">
        {sidebarItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
              pathname === item.href ||
                (item.href !== "/driver/dashboard" &&
                  pathname?.startsWith(item.href))
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <item.icon className="w-5 h-5" />
            {item.title}
          </Link>
        ))}
      </nav>
      <div className="px-4 mt-auto">
        <Link href="/profile">
          <Button variant="outline" className="w-full justify-start gap-2">
            <ArrowLeft className="w-4 h-4" />
            {tCommon("navigation.backToApp")}
          </Button>
        </Link>
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
      <aside className="hidden xl:flex w-64 border-r bg-card flex-col">
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header - Always visible like MainLayout */}
        <header className="border-b border-border bg-card sticky top-0 z-40">
          <div className="flex items-center justify-between px-4 md:px-6 py-2 h-12">
            <h1 className="text-lg font-bold text-foreground">{t("panelTitle")}</h1>
            <div className="flex items-center gap-2">
              <Link href="/profile">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  {tCommon("buttons.back")}
                </Button>
              </Link>
              <NotificationBell />
            </div>
          </div>
        </header>

        {/* Content Area - Wrapper provides consistent padding */}
        <main
          className={cn(
            "flex-1 overflow-y-auto overflow-x-hidden xl:pb-0",
            !hideBottomNav && "pb-[88px]"
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
