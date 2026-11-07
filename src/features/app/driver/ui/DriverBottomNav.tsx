"use client";

import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, MessageSquare } from "lucide-react";
import { FloatingNav } from "@/components/layouts/FloatingNav";
import { useTranslations } from "next-intl";
import { useUnreadMessages } from "@/features/app/messages/hooks";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

export function DriverBottomNav() {
  const pathname = usePathname();
  const t = useTranslations("driver.navigation");
  const { unreadCount } = useUnreadMessages();

  const navItems: NavItem[] = [
    {
      href: "/driver/dashboard",
      label: t("dashboard"),
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      href: "/driver/shipments",
      label: t("shipments"),
      icon: <Package className="w-5 h-5" />,
    },
    {
      href: "/driver/messages",
      label: t("messages"),
      icon: <MessageSquare className="w-5 h-5" />,
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
  ];

  return (
    <FloatingNav
      items={navItems.map((item) => ({
        ...item,
        active:
          pathname === item.href ||
          (item.href !== "/driver/dashboard" && Boolean(pathname?.startsWith(item.href))),
      }))}
    />
  );
}
