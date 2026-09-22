import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ACTIVE_ACCESS_KEY,
  getStoredAccessMode,
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
    expect(resolveAccessMode(["shipper", "carrier", "admin"], null)).toBe(
      "admin"
    );
    expect(resolveAccessMode(["shipper", "carrier"], null)).toBe("carrier");
    expect(resolveAccessMode(["shipper"], null)).toBe("user");
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
