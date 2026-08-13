"use client";

import type React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Calendar, Plus, MessageCircle, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ReactNode;
  badge?: number;
}

import { useUnreadMessages } from "@/features/app/messages/hooks";

export function BottomNav() {
  const pathname = usePathname();
  const { unreadCount } = useUnreadMessages();
  const t = useTranslations("common.navigation");

  const navItems: NavItem[] = [
    { href: "/home", labelKey: "home", icon: <Home className="w-5 h-5" /> },
    {
      href: "/deliveries",
      labelKey: "shipments",
      icon: <Calendar className="w-5 h-5" />,
    },
    { href: "/create", labelKey: "create", icon: <Plus className="w-5 h-5" /> },
    {
      href: "/messages",
      labelKey: "messages",
      icon: <MessageCircle className="w-5 h-5" />,
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
    { href: "/profile", labelKey: "account", icon: <User className="w-5 h-5" /> },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border/50 xl:hidden pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] h-[88px]">
      <div className="flex justify-around items-stretch max-w-lg mx-auto h-full">
        {navItems.map((item) => {
          const isActive = pathname?.startsWith(item.href);
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
                {t(item.labelKey)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

