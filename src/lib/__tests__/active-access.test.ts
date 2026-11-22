import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ACTIVE_ACCESS_KEY,
  getStoredAccessMode,
  hasAdminAccess,
  modeLanding,
  qualifiedAccessModes,
  resolveAccessMode,
  setStoredAccessMode,
} from "../active-access";

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("qualifiedAccessModes", () => {
  it("always includes user, even for an account granted nothing", () => {
    expect(qualifiedAccessModes([])).toEqual(["user"]);
  });

  it("adds carrier for a carrier role", () => {
    expect(qualifiedAccessModes(["shipper", "carrier"])).toEqual([
      "carrier",
      "user",
    ]);
  });

  it("adds carrier for a driver role", () => {
    expect(qualifiedAccessModes(["shipper", "driver"])).toEqual([
      "carrier",
      "user",
    ]);
  });

  it("adds admin for any of the four staff roles", () => {
    for (const role of ["admin", "operator", "support", "finance"]) {
      expect(qualifiedAccessModes([role])).toEqual(["admin", "user"]);
    }
  });

  it("returns all three, most-privileged first, for a multi-role account", () => {
    expect(qualifiedAccessModes(["shipper", "carrier", "admin"])).toEqual([
      "admin",
      "carrier",
      "user",
    ]);
  });
});

describe("resolveAccessMode", () => {
  it("defaults to the strongest qualified mode with nothing stored", () => {
    expect(resolveAccessMode(["shipper", "admin"], null)).toBe("admin");
    expect(resolveAccessMode(["shipper", "carrier"], null)).toBe("carrier");
    expect(resolveAccessMode(["shipper"], null)).toBe("user");
  });

  it("opens an admin who also drives on Driver mode, where the board is", () => {
    expect(resolveAccessMode(["shipper", "carrier", "admin"], null)).toBe("carrier");
    expect(resolveAccessMode(["shipper", "driver", "operator"], null)).toBe("carrier");
    // …while an explicit choice of the back office is still honoured.
    expect(resolveAccessMode(["shipper", "carrier", "admin"], "admin")).toBe("admin");
  });

  it("honours a stored preference the account still qualifies for", () => {
    expect(resolveAccessMode(["shipper", "carrier", "admin"], "user")).toBe(
      "user"
    );
  });

  it("falls back when the stored preference is no longer held", () => {
    // A carrier role revoked since the preference was stored.
    expect(resolveAccessMode(["shipper"], "carrier")).toBe("user");
  });
});

describe("stored access mode", () => {
  it("reports null on a device with nothing stored", () => {
    expect(getStoredAccessMode()).toBeNull();
  });

  it("round-trips a value that was set", () => {
    setStoredAccessMode("carrier");
    expect(window.localStorage.getItem(ACTIVE_ACCESS_KEY)).toBe("carrier");
    expect(getStoredAccessMode()).toBe("carrier");
  });

  it("treats an unrecognised stored value as nothing stored", () => {
    window.localStorage.setItem(ACTIVE_ACCESS_KEY, "shipper");
    expect(getStoredAccessMode()).toBeNull();
  });

  it("does not throw when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });

    expect(() => setStoredAccessMode("admin")).not.toThrow();
    expect(getStoredAccessMode()).toBeNull();
  });
});

// roles_spec.md §5.1: the mode is offered exactly when the proxy would let the
// account into at least one back-office page, and it opens on that page.
describe("Admin mode for every staff role", () => {
  it.each(["admin", "operator", "support", "finance"])("offers Admin mode to %s", (role) => {
    expect(hasAdminAccess(["shipper", role])).toBe(true);
    expect(qualifiedAccessModes(["shipper", role])).toEqual(["admin", "user"]);
  });

  it("does not offer it to an account with no staff role", () => {
    expect(hasAdminAccess(["shipper", "carrier", "driver"])).toBe(false);
  });

  it.each([
    ["admin", "/admin/expedion"],
    ["operator", "/admin/bordereaux"],
    ["support", "/admin/support"],
    ["finance", "/admin/withdrawals"],
  ])("lands %s on %s, not on a page that would bounce", (role, landing) => {
    expect(modeLanding("admin", ["shipper", role])).toBe(landing);
  });

  it("lands the other modes on /home whatever the roles", () => {
    expect(modeLanding("user", ["shipper", "admin"])).toBe("/home");
    expect(modeLanding("carrier", ["carrier", "operator"])).toBe("/home");
    // Never a back-office address for roles that hold none.
    expect(modeLanding("admin", ["shipper"])).toBe("/home");
  });
});
