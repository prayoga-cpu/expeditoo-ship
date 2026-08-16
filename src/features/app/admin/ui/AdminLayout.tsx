"use client";

import { NotificationBell } from "@/components/NotificationBell";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FileText,
  ArrowLeft,
  Truck,
  Headset,
  UserCircle,
  DollarSign,
  Gavel,
  ClipboardCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AdminBottomNav } from "./AdminBottomNav";
import { AppSidebarHeader } from "@/components/layouts/AppSidebarHeader";
import { useTranslations } from "next-intl";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");

  const sidebarItems = [
    {
      // The whole-platform report. Was reachable only by typing the URL, and
      // it has absorbed /admin/dashboard, so it takes the landing slot.
      title: t("navigation.expedion"),
      href: "/admin/expedion",
      icon: LayoutDashboard,
    },
    {
      title: t("navigation.users"),
      href: "/admin/users",
      icon: Users,
    },
    {
      title: t("navigation.awards"),
      href: "/admin/awards",
      icon: Gavel,
    },
    {
      title: t("navigation.listing"),
      href: "/admin/listings",
      icon: FileText,
    },
    {
      title: t("navigation.applications"),
      href: "/admin/applications",
      icon: ClipboardCheck,
    },
    {
      title: t("navigation.driver"),
      href: "/admin/drivers",
      icon: Users,
    },
    {
      title: t("navigation.shipment"),
      href: "/admin/shipments",
      icon: Truck,
    },
    {
      title: t("navigation.payments"),
      href: "/admin/payments",
      icon: DollarSign,
    },
    {
      title: t("navigation.supportChats"),
      href: "/admin/support",
      icon: Headset,
    },
    {
      title: t("navigation.profile"),
      href: "/admin/profile",
      icon: UserCircle,
    },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full pb-4">
      <AppSidebarHeader href="/admin/expedion" subtitle={t("panelTitle")} />
      <nav className="flex-1 px-4 space-y-2">
        {sidebarItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
              pathname === item.href
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
      style={
        {
          "--loader-offset-mobile": "8.5rem", // Header (3rem) + Nav (5.5rem)
          "--loader-offset-desktop": "7rem", // Header + Padding buffer
        } as React.CSSProperties
      }
    >
      {/* Desktop Sidebar - Static like MainLayout */}
      <aside className="hidden xl:flex w-64 border-r bg-card flex-col">
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header - Always visible like MainLayout */}
        <header className="border-b border-border bg-card shrink-0 z-40">
          <div className="flex items-center justify-between px-4 md:px-6 py-2 h-12">
            <h1 className="text-lg font-bold text-foreground">
              {t("panelTitle")}
            </h1>
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
          className="flex-1 overflow-y-auto overflow-x-hidden pb-[88px] xl:pb-0 overscroll-contain"
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
