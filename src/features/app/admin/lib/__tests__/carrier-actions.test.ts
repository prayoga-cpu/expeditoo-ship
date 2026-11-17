import { describe, expect, it } from "vitest";

import type { CarrierApplication } from "../../api/carriers.api";
import {
  actionsFor,
  defaultTab,
  documentProgress,
  matchesFilters,
  tabCounts,
  tabOf,
} from "../carrier-actions";

const app = (over: Partial<CarrierApplication> = {}) =>
  ({
    id: "c1",
    status: "approved",
    kind: "professional",
    absentSince: null,
    absentUntil: null,
    contactConfirmedAt: null,
    documents: [],
    vehicles: [],
    ...over,
  }) as CarrierApplication;

const away = { absentSince: new Date().toISOString() };

describe("actionsFor — one row per state (driver_page_management_spec.md §2)", () => {
  it.each([
    ["draft", {}, { primary: "approve", secondary: null, menu: [] }],
    ["submitted", {}, { primary: "approve", secondary: "reject", menu: [] }],
    ["under_review", {}, { primary: "approve", secondary: "reject", menu: [] }],
    ["approved", {}, { primary: null, secondary: null, menu: ["markAbsent", "suspend", "remove"] }],
    ["approved", away, { primary: "endAbsence", secondary: null, menu: ["suspend", "remove"] }],
    ["suspended", {}, { primary: "reactivate", secondary: null, menu: ["remove"] }],
    ["rejected", {}, { primary: "approve", secondary: null, menu: [] }],
    ["deregistered", {}, { primary: "approve", secondary: null, menu: [] }],
  ] as const)("%s %o", (status, over, expected) => {
    expect(actionsFor(app({ status, ...over }))).toEqual(expected);
  });

  it("never offers « mark away » to a driver who is already away", () => {
    expect(actionsFor(app(away)).menu).not.toContain("markAbsent");
  });

  it("never offers a second visible button on an active driver", () => {
    const a = actionsFor(app());
    expect([a.primary, a.secondary].filter(Boolean)).toHaveLength(0);
  });
});

describe("tabOf and the tab counts", () => {
  it("files every status under exactly one tab", () => {
    expect(tabOf(app({ status: "submitted" }))).toBe("review");
    expect(tabOf(app({ status: "under_review" }))).toBe("review");
    expect(tabOf(app({ status: "approved" }))).toBe("active");
    expect(tabOf(app({ status: "approved", ...away }))).toBe("paused");
    expect(tabOf(app({ status: "suspended" }))).toBe("paused");
    expect(tabOf(app({ status: "rejected" }))).toBe("closed");
    expect(tabOf(app({ status: "deregistered" }))).toBe("closed");
    expect(tabOf(app({ status: "draft" }))).toBe("draft");
  });

  const pool = [
    app({ id: "1", status: "submitted", kind: "private" }),
    app({ id: "2", status: "submitted" }),
    app({ id: "3", status: "approved" }),
    app({ id: "4", status: "approved", kind: "private", ...away }),
    app({ id: "5", status: "deregistered" }),
  ];

  it("counts by tab, and « all » is the sum", () => {
    expect(tabCounts(pool, "all")).toEqual({
      review: 2,
      active: 1,
      paused: 1,
      closed: 1,
      draft: 0,
      all: 5,
    });
  });

  it("applies the driver type to the counts", () => {
    const counts = tabCounts(pool, "private");
    expect(counts.all).toBe(2);
    expect(counts.review).toBe(1);
    expect(counts.paused).toBe(1);
  });

  it("lands on « to review » when something waits, else on « active »", () => {
    expect(defaultTab(tabCounts(pool, "all"))).toBe("review");
    expect(defaultTab(tabCounts([app()], "all"))).toBe("active");
  });
});

describe("matchesFilters", () => {
  const reached = app({ contactConfirmedAt: "2026-11-01T10:00:00.000Z", status: "submitted" });
  const notReached = app({ status: "submitted" });

  it("combines the tab, the type and « not reached yet »", () => {
    const f = { tab: "review", kind: "all", notReachedOnly: true } as const;
    expect(matchesFilters(notReached, f)).toBe(true);
    expect(matchesFilters(reached, f)).toBe(false);
    expect(matchesFilters(app({ status: "approved" }), f)).toBe(false);
    expect(matchesFilters(notReached, { ...f, kind: "private" })).toBe(false);
  });

  it("shows everything on « all » with no filter", () => {
    expect(matchesFilters(app({ status: "rejected" }), { tab: "all", kind: "all", notReachedOnly: false })).toBe(true);
  });
});

describe("documentProgress", () => {
  it("counts accepted out of the files on record", () => {
    const documents = [{ status: "accepted" }, { status: "pending" }, { status: "accepted" }] as CarrierApplication["documents"];
    expect(documentProgress({ documents })).toEqual({ accepted: 2, total: 3 });
    expect(documentProgress({ documents: [] })).toEqual({ accepted: 0, total: 0 });
  });
});
