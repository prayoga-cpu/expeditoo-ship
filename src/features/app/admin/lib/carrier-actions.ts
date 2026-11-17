import { isAbsent } from "@/lib/carrier-availability";
import type { CarrierApplication } from "../api/carriers.api";

/**
 * What an admin may do to a driver, by state — one table instead of a pile of
 * `canX` booleans in the dialog (driver_page_management_spec.md §2). The
 * footer shows `primary` and `secondary`; everything else sits in « Plus
 * d'actions ». The services still decide what is *allowed*; this only decides
 * what is *offered*.
 */
export type DriverAction =
  | "approve"
  | "reject"
  | "markAbsent"
  | "endAbsence"
  | "suspend"
  | "reactivate"
  | "remove";

export interface DriverActions {
  primary: DriverAction | null;
  secondary: DriverAction | null;
  menu: DriverAction[];
}

export function actionsFor(
  application: Pick<
    CarrierApplication,
    "status" | "absentSince" | "absentUntil"
  >
): DriverActions {
  switch (application.status) {
    case "submitted":
    case "under_review":
      return { primary: "approve", secondary: "reject", menu: [] };
    case "approved":
      return isAbsent(application)
        ? { primary: "endAbsence", secondary: null, menu: ["suspend", "remove"] }
        : {
            primary: null,
            secondary: null,
            menu: ["markAbsent", "suspend", "remove"],
          };
    case "suspended":
      return { primary: "reactivate", secondary: null, menu: ["remove"] };
    // A draft, a refusal and a removal are all undone the same way: approving
    // directly (`carrierService.approve` needs no submission).
    case "draft":
    case "rejected":
    case "deregistered":
      return { primary: "approve", secondary: null, menu: [] };
  }
}

// ---- The page's tabs ----

export const DRIVER_TABS = [
  "review",
  "active",
  "paused",
  "closed",
  "draft",
  "all",
] as const;
export type DriverTab = (typeof DRIVER_TABS)[number];

/** The one tab a file belongs to (« all » is a view, not a home). */
export function tabOf(
  application: Pick<
    CarrierApplication,
    "status" | "absentSince" | "absentUntil"
  >
): Exclude<DriverTab, "all"> {
  switch (application.status) {
    case "submitted":
    case "under_review":
      return "review";
    case "approved":
      return isAbsent(application) ? "paused" : "active";
    case "suspended":
      return "paused";
    case "rejected":
    case "deregistered":
      return "closed";
    case "draft":
      return "draft";
  }
}

export type KindFilter = "all" | CarrierApplication["kind"];

export interface DriverFilters {
  tab: DriverTab;
  kind: KindFilter;
  /** « Pas encore joint »: contact not confirmed. */
  notReachedOnly: boolean;
}

export function matchesFilters(
  application: CarrierApplication,
  { tab, kind, notReachedOnly }: DriverFilters
): boolean {
  if (tab !== "all" && tabOf(application) !== tab) return false;
  if (kind !== "all" && application.kind !== kind) return false;
  if (notReachedOnly && application.contactConfirmedAt) return false;
  return true;
}

/** Counts per tab for the badges; the kind filter applies, the tab does not. */
export function tabCounts(
  applications: CarrierApplication[],
  kind: KindFilter
): Record<DriverTab, number> {
  const counts: Record<DriverTab, number> = {
    review: 0,
    active: 0,
    paused: 0,
    closed: 0,
    draft: 0,
    all: 0,
  };
  for (const application of applications) {
    if (kind !== "all" && application.kind !== kind) continue;
    counts[tabOf(application)] += 1;
    counts.all += 1;
  }
  return counts;
}

/** Where to land: what waits for a decision, else the working pool. */
export function defaultTab(counts: Record<DriverTab, number>): DriverTab {
  return counts.review > 0 ? "review" : "active";
}

/** Accepted documents out of the ones on file — the list's « 2/3 ». */
export function documentProgress(
  application: Pick<CarrierApplication, "documents">
): { accepted: number; total: number } {
  const total = application.documents.length;
  const accepted = application.documents.filter(
    (document) => document.status === "accepted"
  ).length;
  return { accepted, total };
}
