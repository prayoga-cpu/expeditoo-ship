import { describe, expect, it } from "vitest";

import {
  ALL_ROLES,
  NO_ROLE_LABEL,
  ROLE_PRECEDENCE,
  primaryRole,
} from "@/lib/primary-role";

describe("primaryRole", () => {
  it("ranks every role the enum defines", () => {
    // An eighth role added to `userRoleEnum` and forgotten here would silently
    // fall through to `user` — an account with real access reading as one with
    // none. This is the check that makes that a failing test instead.
    expect([...ROLE_PRECEDENCE].sort()).toEqual([...ALL_ROLES].sort());
  });

  it("names the strongest role held, not the first one returned", () => {
    // The order the join hands back is arbitrary, which is the bug this
    // replaced: the admin table printed roles[0].
    expect(primaryRole(["shipper", "admin"])).toBe("admin");
    expect(primaryRole(["admin", "shipper"])).toBe("admin");
    expect(primaryRole(["shipper", "support"])).toBe("support");
    expect(primaryRole(["shipper", "operator", "driver"])).toBe("operator");
  });

  it("keeps carrier and driver apart: the outside driver is not the in-house one", () => {
    expect(primaryRole(["carrier"])).toBe("carrier");
    expect(primaryRole(["driver"])).toBe("driver");
    expect(primaryRole(["carrier", "shipper"])).toBe("carrier");
  });

  it("ranks carrier above driver for an account approved before the split", () => {
    expect(primaryRole(["shipper", "driver", "carrier"])).toBe("carrier");
  });

  it("keeps shipper visible when it is the only role granted", () => {
    // Every signup gets it, so this is the common case, and it must not be
    // mistaken for "no access at all".
    expect(primaryRole(["shipper"])).toBe("shipper");
  });

  it("says user, not a role, when the account holds none", () => {
    expect(primaryRole([])).toBe(NO_ROLE_LABEL);
  });

  it("ignores a value that is not a role", () => {
    expect(primaryRole(["banana"])).toBe(NO_ROLE_LABEL);
    expect(primaryRole(["banana", "finance"])).toBe("finance");
  });
});
