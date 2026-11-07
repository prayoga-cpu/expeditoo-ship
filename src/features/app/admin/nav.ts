import {
  AlertTriangle,
  Car,
  DollarSign,
  FileSpreadsheet,
  FileText,
  Gavel,
  Headset,
  LayoutDashboard,
  MessageSquarePlus,
  Settings,
  Truck,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import type { AdminNavCounts } from "@/server/services/admin-nav.service";

/**
 * The admin navigation, once.
 *
 * The sidebar (`AdminLayout`) and the phone bar (`AdminBottomNav`) each kept
 * their own list, and they drifted: the phone bar had no Awards, Withdrawals or
 * Incidents, so on a phone those pages could not be opened at all. Both now
 * read this, grouped the way an operator thinks about the work.
 *
 * Driver applications are not an entry: they are a tab of Drivers, and the
 * Drivers badge carries both the unreviewed applications and the paperwork about
 * to lapse — everything about drivers that is waiting on staff.
 */
export interface AdminNavEntry {
  href: string;
  /** A key under `admin.navigation`. */
  labelKey: string;
  icon: LucideIcon;
  /** Counts summed into this entry's badge (see `BADGE_TONE` in AdminLayout). */
  badges?: (keyof AdminNavCounts)[];
}

export interface AdminNavGroup {
  id: "operations" | "people" | "money" | "quality" | "system";
  /** A key under `admin.navigation.groups`. */
  labelKey: string;
  items: AdminNavEntry[];
}

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: "operations",
    labelKey: "operations",
    items: [
      { href: "/admin/expedion", labelKey: "expedion", icon: LayoutDashboard, badges: ["expedion"] },
      { href: "/admin/bordereaux", labelKey: "bordereaux", icon: FileSpreadsheet },
      { href: "/admin/awards", labelKey: "awards", icon: Gavel, badges: ["awards"] },
      { href: "/admin/listings", labelKey: "listing", icon: FileText, badges: ["listings"] },
      { href: "/admin/shipments", labelKey: "shipment", icon: Truck, badges: ["shipments"] },
    ],
  },
  {
    id: "people",
    labelKey: "people",
    items: [
      { href: "/admin/users", labelKey: "users", icon: Users, badges: ["users"] },
      { href: "/admin/expedion-clients", labelKey: "expedionClients", icon: UsersRound },
      { href: "/admin/drivers", labelKey: "driver", icon: Car, badges: ["applications", "drivers"] },
    ],
  },
  {
    id: "money",
    labelKey: "money",
    items: [
      { href: "/admin/payments", labelKey: "payments", icon: DollarSign, badges: ["payments"] },
      { href: "/admin/withdrawals", labelKey: "withdrawals", icon: Wallet },
    ],
  },
  {
    id: "quality",
    labelKey: "quality",
    items: [
      { href: "/admin/incidents", labelKey: "incidents", icon: AlertTriangle },
      { href: "/admin/feedback", labelKey: "feedback", icon: MessageSquarePlus, badges: ["feedback"] },
      { href: "/admin/support", labelKey: "supportChats", icon: Headset, badges: ["support"] },
    ],
  },
  {
    id: "system",
    labelKey: "system",
    items: [{ href: "/admin/settings", labelKey: "settings", icon: Settings }],
  },
];

/** The badge for an entry: its counts summed, or undefined while they load. */
export function badgeFor(
  counts: Partial<AdminNavCounts> | undefined,
  entry: AdminNavEntry
): number | undefined {
  if (!entry.badges || !counts) return undefined;
  return entry.badges.reduce((sum, key) => sum + (counts[key] ?? 0), 0);
}
