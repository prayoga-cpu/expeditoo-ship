"use client";

import { NotificationBell } from "@/components/NotificationBell";
import { FeedbackLauncher } from "@/features/app/feedback/ui";
import Link from "next/link";
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

  const SidebarContent = () => (
    <div className="flex flex-col h-full pb-4">
      {/* Same as the admin sidebar: the content header already carries the
          panel title, so a subtitle here just repeated it. */}
      <AppSidebarHeader href="/driver/dashboard" />
      {/* p-4, not px-4: same as the admin sidebar — its subtitle used to supply
          the gap under the logo. Matches the app sidebar. */}
      <nav className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
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
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={handleBack}
        >
          <ArrowLeft className="w-4 h-4" />
          {tCommon("navigation.backToApp")}
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
      <aside className="hidden xl:flex w-64 shrink-0 overflow-hidden border-r bg-card flex-col">
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header - Always visible like MainLayout */}
        <header className="border-b border-border bg-card sticky top-0 z-40">
          <div className="flex items-center justify-between px-4 md:px-6 py-2 h-12">
            <div className="flex min-w-0 items-center gap-3">
              <h1 className="text-lg font-bold text-foreground">{t("panelTitle")}</h1>
              <AppVersionLink className="hidden md:inline-flex" />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="gap-2" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4" />
                {tCommon("buttons.back")}
              </Button>
              <FeedbackLauncher />
              <NotificationBell />
            </div>
          </div>
        </header>

        {/* Content Area - Wrapper provides consistent padding */}
        <main
          className={cn(
            "flex-1 min-h-0 overflow-y-auto overflow-x-hidden xl:pb-0",
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
