import { describe, expect, it } from "vitest";

import { chipsHeld, dbRolesFor, MANAGEABLE_ROLES } from "../role-groups";

describe("dbRolesFor", () => {
  it("expands the driver chip to both carrier and driver", () => {
    expect(dbRolesFor("driver")).toEqual(["carrier", "driver"]);
  });

  it("passes every other manageable role through unchanged", () => {
    for (const role of ["operator", "support", "finance", "admin"]) {
      expect(dbRolesFor(role)).toEqual([role]);
    }
  });
});

describe("chipsHeld", () => {
  it("lights up the driver chip from carrier alone", () => {
    expect(chipsHeld(["shipper", "carrier"])).toEqual(["driver"]);
  });

  it("lights up the driver chip from driver alone", () => {
    expect(chipsHeld(["shipper", "driver"])).toEqual(["driver"]);
  });

  it("does not double the driver chip when both carrier and driver are held", () => {
    expect(chipsHeld(["shipper", "carrier", "driver"])).toEqual(["driver"]);
  });

  it("never lights up a chip for shipper — it grants nothing to manage", () => {
    expect(chipsHeld(["shipper"])).toEqual([]);
  });

  it("returns every manageable role an account holds, in canonical order", () => {
    expect(
      chipsHeld(["admin", "shipper", "carrier", "driver", "finance"])
    ).toEqual(["driver", "finance", "admin"]);
  });

  it("returns nothing held for an account with no manageable role", () => {
    expect(chipsHeld([])).toEqual([]);
  });

  it("only ever returns values from MANAGEABLE_ROLES", () => {
    const held = chipsHeld([
      "shipper",
      "carrier",
      "driver",
      "operator",
      "support",
      "finance",
      "admin",
    ]);
    for (const role of held) {
      expect(MANAGEABLE_ROLES).toContain(role);
    }
  });
});
