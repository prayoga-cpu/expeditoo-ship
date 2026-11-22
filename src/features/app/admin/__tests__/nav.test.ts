import { describe, expect, it } from "vitest";

import en from "../../../../../messages/en.json";
import fr from "../../../../../messages/fr.json";
import { ADMIN_PAGES } from "@/lib/admin-access";
import { ADMIN_NAV_GROUPS, adminNavFor, badgeFor } from "../nav";

const entries = ADMIN_NAV_GROUPS.flatMap((group) => group.items);

describe("admin navigation", () => {
  it("has no page of its own for driver applications — they are a tab of Drivers", () => {
    expect(entries.map((entry) => entry.href)).not.toContain("/admin/applications");
    expect(entries.map((entry) => entry.href)).toContain("/admin/drivers");
  });

  it("lists every page once", () => {
    const hrefs = entries.map((entry) => entry.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it.each([
    ["en", en],
    ["fr", fr],
  ] as const)("has a label for every group and entry in %s", (_locale, messages) => {
    const nav = messages.admin.navigation as Record<string, unknown>;
    const groups = nav.groups as Record<string, string>;
    for (const group of ADMIN_NAV_GROUPS) expect(groups[group.labelKey]).toBeTruthy();
    for (const entry of entries) expect(nav[entry.labelKey]).toBeTruthy();
  });

  it("badges Drivers with the unreviewed applications and the lapsing paperwork together", () => {
    const drivers = entries.find((entry) => entry.href === "/admin/drivers")!;
    expect(badgeFor({ applications: 3, drivers: 2 }, drivers)).toBe(5);
  });

  it("shows no badge while the counts load, or on an entry that has none", () => {
    const drivers = entries.find((entry) => entry.href === "/admin/drivers")!;
    const withdrawals = entries.find((entry) => entry.href === "/admin/withdrawals")!;
    expect(badgeFor(undefined, drivers)).toBeUndefined();
    expect(badgeFor({ applications: 3 }, withdrawals)).toBeUndefined();
  });

  it("agrees with admin-access.ts on which pages are entries, and in which order", () => {
    // `adminLandingFor` walks that list: a different order is a different landing.
    expect(entries.map((entry) => entry.href)).toEqual(
      ADMIN_PAGES.filter((page) => page.nav).map((page) => page.path)
    );
  });

  const hrefsFor = (roles: string[]) =>
    adminNavFor(roles).flatMap((group) => group.items.map((item) => item.href));

  it("shows an admin everything", () => {
    expect(adminNavFor(["admin"])).toEqual(ADMIN_NAV_GROUPS);
  });

  it("shows an operator its own entries only", () => {
    expect(hrefsFor(["shipper", "operator"])).toEqual([
      "/admin/bordereaux",
      "/admin/awards",
      "/admin/listings",
      "/admin/shipments",
      "/admin/drivers",
      "/admin/withdrawals",
      "/admin/incidents",
      "/admin/feedback",
    ]);
  });

  it("shows support and finance theirs, with no heading over an empty group", () => {
    expect(hrefsFor(["support"])).toEqual(["/admin/support"]);
    expect(adminNavFor(["support"]).map((group) => group.id)).toEqual(["quality"]);
    expect(hrefsFor(["finance"])).toEqual(["/admin/withdrawals", "/admin/settings"]);
    expect(adminNavFor(["finance"]).map((group) => group.id)).toEqual(["money", "system"]);
  });

  it("shows nothing to an account with no staff role", () => {
    expect(adminNavFor(["shipper", "carrier"])).toEqual([]);
  });
});
