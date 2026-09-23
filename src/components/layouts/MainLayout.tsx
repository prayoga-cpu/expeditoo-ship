"use client";

import type React from "react";
import { useEffect } from "react";
import { BottomNav } from "../BottomNav";
import { NotificationBell } from "../NotificationBell";
import { ThemeToggle } from "../ui/theme-toggle";
import { LangToggle } from "../ui/lang-toggle";
import { AppVersionLink } from "../ui/app-version";
import { AppSidebarHeader } from "./AppSidebarHeader";
import { HeaderQuickActions } from "./HeaderQuickActions";
import { FeedbackLauncher } from "@/features/app/feedback/ui";
import { BrandWordmark } from "@/components/ui/brand-mark";
import { PageLoader } from "@/components/ui/page-loader";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  PackagePlus,
  Boxes,
  Route,
  Wallet,
  Shield,
  Gavel,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useActiveAccessMode } from "@/lib/use-active-access-mode";
import { useApplicationNav } from "@/lib/use-application-nav";

interface MainLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  /** Marks the one entry that leaves the app for the back office. */
  accent?: boolean;
  /** Only "My application" uses this — flips access mode before navigating. */
  onSelect?: () => void;
}

export function MainLayout({ children }: MainLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { unreadCount } = useUnreadMessages();
  const t = useTranslations("common.navigation");
  const { user } = useAuth();
  const isAdmin = (user?.roles ?? []).includes("admin");
  const { mode } = useActiveAccessMode();
  const applicationNav = useApplicationNav();

  // Admin is its own area (`AdminLayout`, a separate route segment) — a
  // MainLayout page (bookmarked, or landed on by a fresh sign-in that
  // resolves straight to "admin" for an admin+carrier account) must not
  // render the ordinary app sidebar while that's the active mode. The
  // explicit switcher click already lands here correctly (crossing into
  // `/admin/*` is always a real layout remount); this covers the stale/
  // defaulted-mode case that click doesn't.
  useEffect(() => {
    if (mode === "admin") router.replace("/admin/expedion");
  }, [mode, router]);

  // No sidebar, no flash of the wrong nav — just wait out the redirect above.
  if (mode === "admin") return <PageLoader />;

  const home = { href: "/home", label: t("home"), icon: Home };
  const jobs = { href: "/expedion", label: t("jobs"), icon: PlusCircle };
  const messages = {
    href: "/messages",
    label: t("messages"),
    icon: MessageSquare,
    badge: unreadCount > 0 ? unreadCount : undefined,
  };
  const profile = { href: "/profile", label: t("profile"), icon: User };

  /** Someone who has not (yet) moved past posting and applying. */
  const userNavItems: NavItem[] = [
    home,
    { href: "/deliveries", label: t("shipmentTracking"), icon: Package },
    // Same /expedion board as `jobs` below, but "Missions" reads as a
    // driver's own work queue to someone who only posts. This audience
    // already has "Mes demandes" two rows down for what they posted
    // themselves, so this one is named for what it actually is: the open
    // board, browsed rather than owned.
    { href: "/expedion", label: t("browseJobs"), icon: PlusCircle },
    { href: "/listings/me", label: t("myRequests"), icon: Boxes },
    { href: "/create", label: t("requestTransport"), icon: PackagePlus },
    messages,
    profile,
  ];

  /** Reaching this for someone not yet qualified for Driver mode happens
   * through the Home dashboard's own "get started" card
   * (DriverDashboard.tsx), not this nav — `useApplicationNav` flips to Driver
   * mode first for anyone who already qualifies. */
  const myApplication: NavItem = {
    href: "/carrier/application",
    label: t("myApplication"),
    icon: ClipboardList,
    onSelect: applicationNav,
  };

  /** An approved carrier: bidding and earnings, not the posting tools it has
   * moved past — same split BottomNav.tsx already makes on mobile. */
  const carrierNavItems: NavItem[] = [
    home,
    jobs,
    { href: "/carrier/offers", label: t("myOffers"), icon: Gavel },
    { href: "/carrier/trips", label: t("myTrips"), icon: Route },
    { href: "/carrier/withdrawals", label: t("myEarnings"), icon: Wallet },
    myApplication,
    messages,
    profile,
  ];

  /** A driver never bids or sees prices (roles_spec.md) — its second slot is
   * the run it is actually executing, on the driver surface. Trips is safe to
   * carry over from carrierNavItems: `/carrier/trips`' earnings tab is gated
   * on an owned `carriers` record (`requireOwnCarrier`), not the `carrier`
   * role, so a driver-only account sees the same 403 a driver already gets
   * from `/api/carrier/offers` rather than a price it must never see. */
  const driverNavItems: NavItem[] = [
    home,
    jobs,
    { href: "/carrier/trips", label: t("myTrips"), icon: Route },
    { href: "/driver/shipments", label: t("deliveries"), icon: Truck },
    myApplication,
    messages,
    profile,
  ];

  const roles = user?.roles ?? [];
  const navItems = [
    ...(mode === "carrier"
      ? roles.includes("carrier")
        ? carrierNavItems
        : driverNavItems
      : userNavItems),
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
      <aside className="hidden xl:flex w-64 shrink-0 overflow-hidden border-r bg-card flex-col">
        <AppSidebarHeader href="/home" />

        <nav className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/home" && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={
                  item.onSelect
                    ? (e) => {
                        e.preventDefault();
                        item.onSelect!();
                      }
                    : undefined
                }
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
            wordmark with no mark beside it.

            The release rides beside it. From `xl` the logo moves to the
            sidebar and the version is the only thing on this side, which is
            the point: that half of the bar was empty. Below `md` it is hidden
            — at 390px the logo, the driver actions and the utility trio
            already fill the row, and a version is the first thing that can go. */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="xl:hidden">
            <Link href="/home">
              <BrandWordmark size={24} />
            </Link>
          </div>
          <AppVersionLink className="hidden md:inline-flex" />
        </div>

        {/* Right Actions */}
        {/* The session's verbs first — post a request, and, for an approved
            driver, see the board — then the utility controls: language, theme,
            bell. That trio keeps its order and its adjacency because the same
            FR | EN control sits in the landing header and in the Expedion app,
            so someone crossing between the three surfaces finds it in the same
            place; the verbs arrive to the left of it, behind a rule, rather
            than splitting it up. How many of them there are is
            `HeaderQuickActions`' business, not this file's. */}
        <div className="flex items-center gap-1 min-w-0 ml-auto">
          <HeaderQuickActions />
          <FeedbackLauncher />
          <LangToggle className="mr-1" />
          <ThemeToggle />
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
