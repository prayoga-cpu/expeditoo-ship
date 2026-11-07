"use client";

import type React from "react";
import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  Home,
  Calendar,
  FileText,
  Plus,
  MessageCircle,
  Gavel,
  Route,
  Truck,
} from "lucide-react";
import { FloatingNav } from "@/components/layouts/FloatingNav";
import { useTranslations } from "next-intl";

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ReactNode;
  badge?: number;
  /** Replaces the plain navigation: "My application" flips access mode
   * first, « Devenir chauffeur » opens the onboarding dialog instead. */
  onSelect?: () => void;
}

import { useUnreadMessages } from "@/features/app/messages/hooks";
import { useAuth } from "@/lib/auth-context";
import { useActiveAccessMode } from "@/lib/use-active-access-mode";
import { useApplicationNav } from "@/lib/use-application-nav";
import { useCarrierApplication } from "@/features/app/carrier/hooks/useCarrier";
import { DriverOnboardingDialog } from "@/features/app/carrier/ui/DriverOnboardingDialog";

export function BottomNav() {
  const pathname = usePathname();
  const { unreadCount } = useUnreadMessages();
  const t = useTranslations("common.navigation");
  const { user } = useAuth();
  const { mode } = useActiveAccessMode();
  const applicationNav = useApplicationNav();

  // Which bar renders is the same "access mode" MainLayout's desktop
  // sidebar reads (use-active-access-mode.ts) — the two used to disagree,
  // this one deciding from raw role flags on its own. Carrier outranks
  // driver within that mode: the company account manages fleet and KYC,
  // while a driver only executes shipments.
  const roles = user?.roles ?? [];
  const isCarrier = mode === "carrier" && roles.includes("carrier");
  const isDriver = mode === "carrier" && roles.includes("driver");
  const isApplicant = !isCarrier && !isDriver;
  // Driver access with the mode set to User: the applicant bar below would
  // hide the board from someone who can bid on it, so it swaps the
  // application slot for « Missions ». Mode picks the bar; roles decide
  // whether the board is on it.
  const hasDriverRole = roles.includes("driver") || roles.includes("carrier");
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const { data: application } = useCarrierApplication({ enabled: isApplicant });

  const messages: NavItem = {
    href: "/messages",
    labelKey: "messages",
    icon: <MessageCircle className="w-5 h-5" />,
    badge: unreadCount > 0 ? unreadCount : undefined,
  };

  /**
   * A carrier bids and runs the company: its offers and its KYC application.
   * They trade the deliveries shortcut for those; their drivers keep it.
   */
  const carrierItems: NavItem[] = [
    { href: "/home", labelKey: "home", icon: <Home className="w-5 h-5" /> },
    {
      href: "/expedion",
      labelKey: "jobs",
      icon: <Plus className="w-5 h-5" />,
    },
    {
      href: "/carrier/offers",
      labelKey: "myOffers",
      icon: <Gavel className="w-5 h-5" />,
    },
    // The bar holds six; trips takes the application's slot rather than
    // becoming a seventh. Only an approved carrier holds the `carrier` role
    // (`enrolAsOwnDriver` grants it on approval), so the screen this displaces
    // is a status page they have already finished with — and it stays in the
    // sidebar and on /profile.
    {
      href: "/carrier/trips",
      labelKey: "myTrips",
      icon: <Route className="w-5 h-5" />,
    },
    messages,
  ];

  /**
   * A driver never sees offers or prices (roles_spec.md), and
   * /api/carrier/offers answers FORBIDDEN_NOT_CARRIER to one - so their
   * second slot is the run they are actually executing, on the driver
   * surface that carries the status actions and proof of delivery.
   */
  const driverItems: NavItem[] = [
    { href: "/home", labelKey: "home", icon: <Home className="w-5 h-5" /> },
    { href: "/expedion", labelKey: "jobs", icon: <Plus className="w-5 h-5" /> },
    // Safe to carry over from carrierItems: `/carrier/trips`' earnings tab is
    // gated on an owned `carriers` record (`requireOwnCarrier`), not the
    // `carrier` role, so a driver-only account meets the same 403 a driver
    // already gets from `/api/carrier/offers` rather than a price it must
    // never see (see MainLayout.tsx's driverNavItems for the full note).
    {
      href: "/carrier/trips",
      labelKey: "myTrips",
      icon: <Route className="w-5 h-5" />,
    },
    {
      href: "/driver/shipments",
      labelKey: "deliveries",
      icon: <Truck className="w-5 h-5" />,
    },
    messages,
  ];

  /**
   * Anyone without an application yet. Posting, not browsing: `/create` came
   * back and `POST /api/listings` asks only for a session, while the board is
   * bids this person cannot place — so showing them `/expedion` offered the one
   * verb they have no use for and withheld the one they do. Same split the
   * header makes (`HeaderQuickActions.tsx`); the two bars must not disagree,
   * because below `xl` this one is the only navigation there is.
   */
  const applicantItems: NavItem[] = [
    { href: "/home", labelKey: "home", icon: <Home className="w-5 h-5" /> },
    {
      href: "/create",
      labelKey: "requestTransport",
      icon: <Plus className="w-5 h-5" />,
    },
    // Same rule as the sidebar's driver entry (become_driver_spec.md §3):
    // explain the path in a dialog until an application exists, then go
    // straight to it. An approved driver already finished that path, so the
    // slot is the board instead.
    hasDriverRole
      ? { href: "/expedion", labelKey: "jobs", icon: <Plus className="w-5 h-5" /> }
      : application
      ? {
          href: "/carrier/application",
          labelKey: "myApplication",
          icon: <FileText className="w-5 h-5" />,
          onSelect: applicationNav,
        }
      : {
          href: "/carrier/application",
          labelKey: "becomeDriver",
          icon: <Truck className="w-5 h-5" />,
          onSelect: () => setOnboardingOpen(true),
        },
    {
      href: "/deliveries",
      labelKey: "shipments",
      icon: <Calendar className="w-5 h-5" />,
    },
    messages,
  ];

  const navItems: NavItem[] = isCarrier
    ? carrierItems
    : isDriver
      ? driverItems
      : applicantItems;

  return (
    <>
      <FloatingNav
        items={navItems.map((item) => ({
          href: item.href,
          label: t(item.labelKey),
          icon: item.icon,
          badge: item.badge,
          onSelect: item.onSelect,
          active: Boolean(pathname?.startsWith(item.href)),
        }))}
      />
      {isApplicant && (
        <DriverOnboardingDialog open={onboardingOpen} onOpenChange={setOnboardingOpen} />
      )}
    </>
  );
}

