"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, User, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
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
    {
      href: "/driver/profile",
      label: t("profile"),
      icon: <User className="w-5 h-5" />,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border/50 xl:hidden pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50 h-[88px]">
      <div className="flex justify-around items-stretch max-w-lg mx-auto h-full">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/driver/dashboard" &&
              pathname?.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 min-w-0 py-3 px-1 min-h-16 transition-all duration-200 relative group",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isActive && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-primary rounded-b-md transition-all duration-200" />
              )}

              <div
                className={cn(
                  "relative p-1.5 rounded-lg transition-all duration-200",
                  isActive ? "bg-primary/10" : "group-hover:bg-muted"
                )}
              >
                {item.icon}
                {item.badge && (
                  <span className="absolute -top-1 -right-1 bg-destructive text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow-sm">
                    {item.badge}
                  </span>
                )}
              </div>

              {/* Label with proper sizing */}
              <span
                className={cn(
                  "text-[11px] font-medium transition-all duration-200 text-center w-full break-words leading-[1.15] line-clamp-2",
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
    </nav>
  );
}
