"use client";

import type React from "react";
import { BottomNav } from "../BottomNav";
import { NotificationBell } from "../NotificationBell";
import { ThemeToggle } from "../ui/theme-toggle";
import { AppSidebarHeader } from "./AppSidebarHeader";
import { BrandWordmark } from "@/components/ui/brand-mark";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useUnreadMessages } from "@/features/app/messages/hooks";
import {
  Home,
  Package,
  PlusCircle,
  MessageSquare,
  User,
  ClipboardList,
  Shield,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname();
  const { unreadCount } = useUnreadMessages();
  const t = useTranslations("common.navigation");
  const { user } = useAuth();
  const isAdmin = (user?.roles ?? []).includes("admin");

  const navItems = [
    {
      href: "/home",
      label: t("home"),
      icon: Home,
    },
    {
      href: "/deliveries",
      label: t("shipmentTracking"),
      icon: Package,
    },
    {
      href: "/expedion",
      label: t("jobs"),
      icon: PlusCircle,
    },
    {
      href: "/messages",
      label: t("messages"),
      icon: MessageSquare,
      badge: unreadCount > 0 ? unreadCount : undefined, // Add badge
    },
    {
      // Replaces "My jobs". Shippers no longer post here, so the only thing
      // that is "mine" is the application to drive.
      href: "/carrier/application",
      label: t("myApplication"),
      icon: ClipboardList,
    },
    {
      href: "/profile",
      label: t("profile"),
      icon: User,
    },
    // The way back in. The admin sidebar has "Back to App" at its foot, but
    // nothing pointed the other way, so an admin who left the panel had to
    // type the URL to return. Roles come from the session (customSession in
    // auth.ts reads user_roles per request), so this follows a revoked role
    // without a round trip of its own.
    ...(isAdmin
      ? [
          {
            href: "/admin/expedion",
            label: t("adminPanel"),
            icon: Shield,
            // Marked out from the ordinary destinations: this one leaves the
            // app for the back office, and it is the only entry most people
            // will never see.
            accent: true,
          },
        ]
      : []),
  ];

  const hideBottomNav = pathname?.includes("/listing/");

  return (
    <div 
      className="flex h-screen bg-background"
      style={{
        '--loader-offset-mobile': '8.5rem',
        '--loader-offset-desktop': '7rem',
      } as React.CSSProperties}
    >
      <aside className="hidden xl:flex w-64 border-r bg-card flex-col">
        <AppSidebarHeader href="/home" />

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/home" && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors relative", // Added relative
                  item.accent
                    ? isActive
                      ? "bg-destructive text-destructive-foreground"
                      : "text-destructive hover:bg-destructive/10 hover:text-destructive"
                    : isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="ml-auto bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />

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

        {/* Mobile Bottom Nav - Moved inside flex column */}
        {!hideBottomNav && <BottomNav />}
      </div>
    </div>
  );
}

function Header() {

  return (
    <header className="border-b border-border bg-card sticky top-0 z-40">
      <div className="flex items-center justify-between px-4 md:px-6 py-2 h-12">
        {/* Mobile logo. Uses the shared lockup so the mark is present here too
            — this used to be a bare heading, which is why mobile showed the
            wordmark with no mark beside it. */}
        <div className="flex items-center gap-2 shrink-0 xl:hidden">
          <Link href="/home">
            <BrandWordmark size={24} />
          </Link>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1 shrink-0 ml-auto">
          <ThemeToggle />
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
