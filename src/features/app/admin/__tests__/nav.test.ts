import { describe, expect, it } from "vitest";

import en from "../../../../../messages/en.json";
import fr from "../../../../../messages/fr.json";
import { ADMIN_NAV_GROUPS, badgeFor } from "../nav";

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
});
