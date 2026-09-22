import { describe, expect, it } from "vitest";

import { mapApiUser, type ApiUser } from "../map-api-user";

const base: ApiUser = {
  id: "u1",
  email: "u1@example.com",
  name: "U1",
};

describe("mapApiUser", () => {
  it("carries every role the account holds, not just the strongest", () => {
    const user = mapApiUser({ ...base, roles: ["shipper", "carrier", "admin"] });

    expect(user.roles).toEqual(["shipper", "carrier", "admin"]);
    // `role` stays the collapsed one, used for sorting and the KYC dialog's
    // "current role" line — this is what used to be the only thing shown.
    expect(user.role).toBe("admin");
  });

  it("defaults roles to an empty list for an account granted none", () => {
    const user = mapApiUser({ ...base, roles: undefined });

    expect(user.roles).toEqual([]);
    expect(user.role).toBe("user");
  });
});
