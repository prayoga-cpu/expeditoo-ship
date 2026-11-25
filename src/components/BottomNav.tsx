"use client";

import type React from "react";
import { usePathname } from "next/navigation";
import {
  Home,
  Calendar,
  Plus,
  MessageCircle,
  HandCoins,
  Package,
  Route,
  Truck,
} from "lucide-react";
import { FloatingNav, type FloatingNavEntry } from "@/components/layouts/FloatingNav";
import { useTranslations } from "next-intl";

interface NavItem {
  href: string;
  /** Under `common.navigation.bar` — the bar's own short labels, not the
   * sidebar's: five items share a phone's width, and « Demander un
   * transport » at a readable size ended on « … » (2.91.0 #4/#28). */
  labelKey: string;
  icon: React.ReactNode;
  badge?: number;
}

import { useUnreadMessages } from "@/features/app/messages/hooks";
import { useAuth } from "@/lib/auth-context";
import { useActiveAccessMode } from "@/lib/use-active-access-mode";

export function BottomNav() {
  const pathname = usePathname();
  const { unreadCount } = useUnreadMessages();
  const t = useTranslations("common.navigation.bar");
  const { user, isLoading: sessionLoading } = useAuth();
  const { mode } = useActiveAccessMode();

  // Which bar renders is the same "access mode" MainLayout's desktop
  // sidebar reads (use-active-access-mode.ts) — the two used to disagree,
  // this one deciding from raw role flags on its own. Carrier outranks
  // driver within that mode: the company account manages fleet and KYC,
  // while a driver only executes shipments.
  const roles = user?.roles ?? [];
  const isCarrier = mode === "carrier" && roles.includes("carrier");
  const isDriver = mode === "carrier" && roles.includes("driver");
  // Driver access with the mode set to User: the requester bar below would
  // hide the board from someone who can bid on it, so it swaps the
  // « Mes demandes » slot for « Missions ». Mode picks the bar; roles decide
  // whether the board is on it.
  const hasDriverRole = roles.includes("driver") || roles.includes("carrier");

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
      icon: <HandCoins className="w-5 h-5" />,
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
   * Everyone not in Driver mode. Posting, not browsing: `/create` came back
   * and `POST /api/listings` asks only for a session, while the board is bids
   * this person cannot place — so showing them `/expedion` offered the one
   * verb they have no use for and withheld the one they do. Same split the
   * header makes (`HeaderQuickActions.tsx`); the two bars must not disagree,
   * because below `xl` this one is the only navigation there is.
   */
  const requesterItems: NavItem[] = [
    { href: "/home", labelKey: "home", icon: <Home className="w-5 h-5" /> },
    {
      href: "/create",
      labelKey: "requestTransport",
      icon: <Plus className="w-5 h-5" />,
    },
    // The third slot is the list of this person's requests (2.91.0 #35): what
    // someone who posts comes back for. It was « Devenir chauffeur » / « Mon
    // dossier », an invitation most requesters never take, on the one bar a
    // phone has — while « Mes demandes » sat a menu away. The application is
    // still reached from the profile's links, the /home card and banner, and
    // the access switcher (become_driver_spec.md §3). An approved driver
    // browsing in User mode keeps the board here instead.
    hasDriverRole
      ? { href: "/expedion", labelKey: "jobs", icon: <Plus className="w-5 h-5" /> }
      : {
          href: "/listings/me",
          labelKey: "myRequests",
          icon: <Package className="w-5 h-5" />,
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
      : requesterItems;

  const toEntry = (item: NavItem): FloatingNavEntry => ({
    href: item.href,
    label: t(item.labelKey),
    icon: item.icon,
    badge: item.badge,
    active: Boolean(pathname?.startsWith(item.href)),
  });

  // Until the session answers, the bar is drawn with what every set shares —
  // Accueil first, Messages last — and holds the three middle places open
  // (2.96.0 #36). The bar now arrives in the server's HTML, before anyone
  // knows the roles; drawing the requester's five and then swapping them for
  // a driver's put another page under a tap already on its way.
  const entries: FloatingNavEntry[] = sessionLoading
    ? [
        toEntry(navItems[0]),
        ...[1, 2, 3].map((slot) => ({ placeholder: true as const, key: `slot-${slot}` })),
        toEntry(messages),
      ]
    : navItems.map(toEntry);

  return <FloatingNav items={entries} />;
}

