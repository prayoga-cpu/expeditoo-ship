import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

import { userRoleEnum } from "@/db/schema/users";

import {
  ADMIN_PAGES,
  STAFF_ROLES,
  adminLandingFor,
  adminPageFor,
  canOpenAdminPath,
  canReadAdminNavCounts,
  staffRolesOf,
} from "../admin-access";

const APP_ROOT = join(process.cwd(), "src", "app", "(app)");

/** Every `page.tsx` under `src/app/(app)/admin`, as the route it serves. */
function adminPageRoutes(dir = join(APP_ROOT, "admin")): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return adminPageRoutes(full);
    if (entry.name !== "page.tsx") return [];
    return [`/${relative(APP_ROOT, dir).split(sep).join("/")}`];
  });
}

/** A real address for a route pattern: `[id]` becomes a value. */
const concrete = (route: string) => route.replace(/\[[^\]]+\]/g, "abc123");

/** The table the spec prints (roles_spec.md §5.1), restated so a change to
 * the source has to be made twice — once on purpose. */
const EXPECTED: Record<string, string[]> = {
  "/admin": [],
  "/admin/dashboard": [],
  "/admin/expedion": [],
  "/admin/bordereaux": ["operator"],
  "/admin/awards": ["operator"],
  "/admin/listings": ["operator"],
  "/admin/shipments": ["operator"],
  "/admin/users": [],
  "/admin/users/[id]/activity": ["support"],
  "/admin/expedion-clients": [],
  "/admin/drivers": ["operator"],
  "/admin/applications": ["operator"],
  "/admin/payments": [],
  "/admin/withdrawals": ["operator", "finance"],
  "/admin/incidents": ["operator"],
  "/admin/feedback": ["operator"],
  "/admin/support": ["support"],
  "/admin/support/[id]": ["support"],
  "/admin/settings": ["finance"],
  "/admin/profile": ["finance"],
};

describe("admin-access: the table", () => {
  it("names only roles that exist, and never restates the enum", () => {
    for (const role of STAFF_ROLES) expect(userRoleEnum.enumValues).toContain(role);
  });

  it("lists every page file under /admin — a new page fails here until classified", () => {
    const listed = ADMIN_PAGES.map((page) => page.path).sort();
    expect(listed).toEqual(adminPageRoutes().sort());
  });

  it("lists each page once", () => {
    const paths = ADMIN_PAGES.map((page) => page.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("matches the page-by-role table in roles_spec.md §5.1", () => {
    const built = Object.fromEntries(
      ADMIN_PAGES.map((page) => [page.path, [...page.roles]])
    );
    expect(built).toEqual(EXPECTED);
  });
});

describe("canOpenAdminPath", () => {
  it("opens every page to an admin", () => {
    for (const page of ADMIN_PAGES) {
      expect(canOpenAdminPath(["shipper", "admin"], concrete(page.path))).toBe(true);
    }
  });

  it.each(["operator", "support", "finance"] as const)(
    "opens to %s exactly the pages listed for it",
    (role) => {
      for (const page of ADMIN_PAGES) {
        expect([page.path, canOpenAdminPath(["shipper", role], concrete(page.path))]).toEqual([
          page.path,
          EXPECTED[page.path].includes(role),
        ]);
      }
    }
  );

  it.each([[[]], [["shipper"]], [["shipper", "carrier", "driver"]]])(
    "opens nothing to an account with no staff role (%j)",
    (roles) => {
      for (const page of ADMIN_PAGES) {
        expect(canOpenAdminPath(roles, concrete(page.path))).toBe(false);
      }
    }
  );

  it("fails closed on a path nobody listed: admin only", () => {
    for (const path of ["/admin/secrets", "/admin/bordereaux-v2", "/administration"]) {
      expect(canOpenAdminPath(["admin"], path)).toBe(true);
      expect(canOpenAdminPath(["operator", "support", "finance"], path)).toBe(false);
    }
  });

  it("takes the longest matching row, on whole segments", () => {
    // The activity page is support's; the list above it is not.
    expect(canOpenAdminPath(["support"], "/admin/users/u1/activity")).toBe(true);
    expect(canOpenAdminPath(["support"], "/admin/users/u1")).toBe(false);
    expect(canOpenAdminPath(["support"], "/admin/users")).toBe(false);
    // A thread is not the list.
    expect(canOpenAdminPath(["support"], "/admin/support")).toBe(true);
    expect(canOpenAdminPath(["support"], "/admin/support/c1")).toBe(true);
    // `/admin/expedion-clients` is not under `/admin/expedion`, nor the reverse.
    expect(adminPageFor("/admin/expedion-clients")?.path).toBe("/admin/expedion-clients");
    expect(adminPageFor("/admin/expedion")?.path).toBe("/admin/expedion");
    // A child of a listed page inherits it.
    expect(canOpenAdminPath(["operator"], "/admin/listings/anything/below")).toBe(true);
  });

  it("ignores a query string and a trailing slash", () => {
    expect(canOpenAdminPath(["operator"], "/admin/drivers?tab=applications")).toBe(true);
    expect(canOpenAdminPath(["operator"], "/admin/drivers/")).toBe(true);
  });

  it("gives a multi-role account the union", () => {
    const roles = ["shipper", "support", "finance"];
    expect(canOpenAdminPath(roles, "/admin/support")).toBe(true);
    expect(canOpenAdminPath(roles, "/admin/settings")).toBe(true);
    expect(canOpenAdminPath(roles, "/admin/awards")).toBe(false);
  });
});

describe("adminLandingFor", () => {
  it.each([
    [["admin"], "/admin/expedion"],
    [["shipper", "operator"], "/admin/bordereaux"],
    [["shipper", "support"], "/admin/support"],
    [["shipper", "finance"], "/admin/withdrawals"],
    [["support", "finance"], "/admin/withdrawals"],
    [["operator", "admin"], "/admin/expedion"],
  ])("lands %j on %s", (roles, landing) => {
    expect(adminLandingFor(roles)).toBe(landing);
  });

  it("has nowhere to send an account with no staff role", () => {
    expect(adminLandingFor([])).toBeNull();
    expect(adminLandingFor(["shipper", "carrier", "driver"])).toBeNull();
  });

  it("always lands on a sidebar entry the account may open", () => {
    for (const role of STAFF_ROLES) {
      const landing = adminLandingFor([role]);
      expect(landing).not.toBeNull();
      expect(canOpenAdminPath([role], landing!)).toBe(true);
      expect(ADMIN_PAGES.find((page) => page.path === landing)?.nav).toBe(true);
    }
  });
});

describe("helpers", () => {
  it("keeps only the staff roles", () => {
    expect(staffRolesOf(["shipper", "carrier", "finance", "admin"])).toEqual(["admin", "finance"]);
  });

  it("asks for the badge counts only where the service answers", () => {
    expect(canReadAdminNavCounts(["admin"])).toBe(true);
    expect(canReadAdminNavCounts(["operator"])).toBe(true);
    expect(canReadAdminNavCounts(["support"])).toBe(false);
    expect(canReadAdminNavCounts(["finance"])).toBe(false);
  });
});
