"use client";

import type React from "react";
import { Fragment, useEffect, useState } from "react";
import { BottomNav } from "../BottomNav";
import { NotificationBell } from "../NotificationBell";
import { HeaderToolbox } from "./HeaderToolbox";
import { AppVersionLink } from "../ui/app-version";
import { AppSidebarHeader } from "./AppSidebarHeader";
import { AccessSwitcher } from "./AccessSwitcher";
import { HeaderQuickActions } from "./HeaderQuickActions";
import { HeaderAccount } from "./HeaderAccount";
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
  Navigation,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useActiveAccessMode } from "@/lib/use-active-access-mode";
import { useApplicationNav } from "@/lib/use-application-nav";
import { useCarrierApplication } from "@/features/app/carrier/hooks/useCarrier";
import { DriverOnboardingDialog } from "@/features/app/carrier/ui/DriverOnboardingDialog";

interface MainLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  /** Where an application stands, as a pill — the driver entry only. */
  status?: string;
  /** Sets an entry apart from the ordinary destinations: `destructive` for
   * the one that leaves for the back office, `success` (the Driver badge's
   * colour) for the way into becoming a driver. */
  accent?: "destructive" | "success";
  /** The sidebar heading this entry sits under (`common.navigation.groups`).
   * Entries without one — Home — head the list. */
  group?: "requests" | "work" | "money" | "account";
  /** Replaces the plain navigation: "My application" flips access mode
   * first, « Devenir chauffeur » opens the onboarding dialog instead. */
  onSelect?: () => void;
}

const ACCENT_CLASSES: Record<NonNullable<NavItem["accent"]>, { active: string; idle: string }> = {
  destructive: {
    active: "bg-destructive text-destructive-foreground",
    idle: "text-destructive hover:bg-destructive/10 hover:text-destructive",
  },
  // Tinted rather than filled when active: dark mode's `--success` is a light
  // green and `--success-foreground` stays white, which does not read on it.
  success: {
    active: "bg-success/20 text-success",
    idle: "text-success hover:bg-success/10 hover:text-success",
  },
};

export function MainLayout({ children }: MainLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { unreadCount } = useUnreadMessages();
  const t = useTranslations("common.navigation");
  const tGroups = useTranslations("common.navigation.groups");
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const isAdmin = roles.includes("admin");
  const hasDriverRole = roles.includes("driver") || roles.includes("carrier");
  const { mode } = useActiveAccessMode();
  const applicationNav = useApplicationNav();
  const tStatus = useTranslations("carrier.onboarding.status");
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  // User mode renders the driver entry below. Driver mode carries « Mon dossier »
  // only while the file is not approved: once it is, the application lives in
  // Profile, and a suspended or deregistered driver — who still needs it, to
  // deregister or apply again — gets the entry back. Admin mode never gets here.
  const { data: application } = useCarrierApplication({ enabled: mode !== "admin" });

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

  /** The way into driving, or where the application stands
   * (become_driver_spec.md §3). Set apart in the Driver badge's green the
   * way « Panneau d'administration » is set apart in red: this sidebar had
   * no way in at all, while the mobile bar did. Before an application
   * exists it explains the path first, in a dialog, rather than dropping
   * someone into a SIRET form cold. */
  const driverEntry: NavItem = application
    ? {
        href: "/carrier/application",
        label: t("myApplication"),
        icon: ClipboardList,
        accent: "success",
        status: tStatus(application.status),
        onSelect: applicationNav,
      }
    : {
        href: "/carrier/application",
        label: t("becomeDriver"),
        icon: Truck,
        accent: "success",
        onSelect: () => setOnboardingOpen(true),
      };

  /** Someone who has not (yet) moved past posting and applying. */
  const userNavItems: NavItem[] = [
    home,
    { href: "/create", label: t("requestTransport"), icon: PackagePlus, group: "requests" },
    { href: "/listings/me", label: t("myRequests"), icon: Boxes, group: "requests" },
    { href: "/deliveries", label: t("shipmentTracking"), icon: Package, group: "requests" },
    // The open board is for people who can act on it. A requester has « Mes
    // demandes » for their own jobs and cannot bid on anyone's, so it is
    // offered once there is an application — an applicant may read it while
    // the file is reviewed (`JobBoard` says bidding opens on approval) — and
    // to a driver who is browsing as a requester.
    ...(application || hasDriverRole
      ? [{ href: "/expedion", label: t("browseJobs"), icon: PlusCircle, group: "account" as const }]
      : []),
    { ...messages, group: "account" },
    { ...profile, group: "account" },
    { ...driverEntry, group: "account" },
  ];

  /** `useApplicationNav` flips to Driver mode first for anyone who already
   * qualifies; user mode has its own entry, `driverEntry`, above. */
  const myApplication: NavItem = {
    href: "/carrier/application",
    label: t("myApplication"),
    icon: ClipboardList,
    onSelect: applicationNav,
  };

  /** « Mon dossier » while the file is not approved (suspended, refused,
   * deregistered, in review): the driver surfaces' dead end otherwise. */
  const needsApplication = !!application && application.status !== "approved";

  /** An approved carrier: bidding and earnings, not the posting tools it has
   * moved past — same split BottomNav.tsx already makes on mobile. */
  const carrierNavItems: NavItem[] = [
    home,
    { ...jobs, group: "work" },
    { href: "/carrier/offers", label: t("myOffers"), icon: Gavel, group: "work" },
    { href: "/carrier/trips", label: t("myTrips"), icon: Route, group: "work" },
    { href: "/carrier/planner", label: t("planner"), icon: Navigation, group: "work" },
    { href: "/carrier/withdrawals", label: t("myEarnings"), icon: Wallet, group: "money" },
    ...(needsApplication ? [{ ...myApplication, group: "account" as const }] : []),
    { ...messages, group: "account" },
    { ...profile, group: "account" },
  ];

  /** A driver never bids or sees prices (roles_spec.md) — its second slot is
   * the run it is actually executing, on the driver surface. Trips is safe to
   * carry over from carrierNavItems: `/carrier/trips`' earnings tab is gated
   * on an owned `carriers` record (`requireOwnCarrier`), not the `carrier`
   * role, so a driver-only account sees the same 403 a driver already gets
   * from `/api/carrier/offers` rather than a price it must never see. */
  const driverNavItems: NavItem[] = [
    home,
    { ...jobs, group: "work" },
    { href: "/carrier/trips", label: t("myTrips"), icon: Route, group: "work" },
    { href: "/driver/shipments", label: t("deliveries"), icon: Truck, group: "work" },
    { href: "/carrier/planner", label: t("planner"), icon: Navigation, group: "work" },
    ...(needsApplication ? [{ ...myApplication, group: "account" as const }] : []),
    { ...messages, group: "account" },
    { ...profile, group: "account" },
  ];

  const navItems: NavItem[] = [
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
            accent: "destructive" as const,
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
          {navItems.map((item, index) => {
            // A heading where the group changes. The admin shortcut carries
            // none and follows the last group, so it never gets a stray one.
            const heading =
              item.group && item.group !== navItems[index - 1]?.group
                ? tGroups(item.group)
                : null;
            const isActive =
              pathname === item.href ||
              (item.href !== "/home" && pathname?.startsWith(item.href));
            return (
              <Fragment key={item.href}>
                {heading && (
                  <p className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                    {heading}
                  </p>
                )}
              <Link
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
                      ? ACCENT_CLASSES[item.accent].active
                      : ACCENT_CLASSES[item.accent].idle
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
                {item.status && (
                  <span className="ml-auto shrink-0 whitespace-nowrap rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-semibold">
                    {item.status}
                  </span>
                )}
              </Link>
              </Fragment>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />

        {/* Content Area - Wrapper provides consistent padding.
            `relative` makes this the containing block for every absolutely
            positioned descendant. Without it an `sr-only` input (position:
            absolute) with no positioned ancestor escapes this scroller,
            stretches the document to wherever it sits, and a second, page-level
            scrollbar appears that slides the whole shell up over blank space. */}
        <main
          className={cn(
            "relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden xl:pb-0",
            !hideBottomNav && "pb-[calc(88px_+_env(safe-area-inset-bottom))]"
          )}
          style={{ scrollbarGutter: "stable" }}
        >
          <div className="p-4 md:p-6">{children}</div>
        </main>

        {/* Mobile Bottom Nav - Moved inside flex column */}
        {!hideBottomNav && <BottomNav />}
      </div>

      <DriverOnboardingDialog open={onboardingOpen} onOpenChange={setOnboardingOpen} />
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
          {/* The sidebar, where the switcher lives from `xl`, does not exist
              on a phone — so a driver sitting in the wrong mode had no way to
              see, let alone change, which one they were in. */}
          <AccessSwitcher className="max-md:hidden xl:hidden" />
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
            `HeaderQuickActions`' business, not this file's. Whose session
            this is closes the row, in the corner the client asked for. */}
        <div className="flex items-center gap-1 min-w-0 ml-auto">
          <HeaderQuickActions />
          <HeaderToolbox showAccess />
          <NotificationBell />
          <HeaderAccount profileHref="/profile" />
        </div>
      </div>
    </header>
  );
}
