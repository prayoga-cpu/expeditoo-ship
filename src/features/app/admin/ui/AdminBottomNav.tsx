"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useEffect } from "react";
import {
  LayoutDashboard,
  Users,
  FileText,
  Truck,
  UserCircle,
  DollarSign,
  Headset,
  Car,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

export function AdminBottomNav() {
  const pathname = usePathname();
  const t = useTranslations("admin.navigation");
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);

  // All navigation items
  const navItems: NavItem[] = [
    {
      href: "/admin/dashboard",
      label: t("dashboard"),
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      href: "/admin/users",
      label: t("users"),
      icon: <Users className="w-5 h-5" />,
    },
    {
      href: "/admin/listings",
      label: t("listing"),
      icon: <FileText className="w-5 h-5" />,
    },
    {
      href: "/admin/drivers",
      label: t("driver"),
      icon: <Car className="w-5 h-5" />,
    },
    {
      href: "/admin/shipments",
      label: t("shipment"),
      icon: <Truck className="w-5 h-5" />,
    },
    {
      href: "/admin/payments",
      label: t("payments"),
      icon: <DollarSign className="w-5 h-5" />,
    },
    {
      href: "/admin/support",
      label: t("supportChats"),
      icon: <Headset className="w-5 h-5" />,
    },
    {
      href: "/admin/profile",
      label: t("profile"),
      icon: <UserCircle className="w-5 h-5" />,
    },
  ];

  // Auto-scroll to active item on mount
  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const activeItem = activeRef.current;
      const containerWidth = container.offsetWidth;
      const itemLeft = activeItem.offsetLeft;
      const itemWidth = activeItem.offsetWidth;
      
      // Center the active item in the viewport
      const scrollPosition = itemLeft - (containerWidth / 2) + (itemWidth / 2);
      container.scrollTo({ left: scrollPosition, behavior: "smooth" });
    }
  }, [pathname]);

  return (
    <nav 
      aria-label="Admin navigation"
      className="fixed bottom-0 left-0 right-0 bg-background border-t border-border/50 xl:hidden safe-area-inset shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50 h-[88px]"
    >
      <div 
        ref={scrollRef}
        role="menubar"
        aria-label="Admin menu - scroll horizontally for more options"
        className="flex overflow-x-auto scrollbar-hide scroll-smooth sm:justify-center"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {navItems.map((item) => {
          const isActive = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              ref={isActive ? activeRef : undefined}
              role="menuitem"
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-3 px-4 min-w-[72px] min-h-16 transition-all duration-200 relative group shrink-0",
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

              <span
                className={cn(
                  "text-[10px] font-medium transition-all duration-200 whitespace-nowrap",
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
      
      {/* Fade indicators for scroll hint */}
      <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-background to-transparent pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-background to-transparent pointer-events-none" />
    </nav>
  );
}

