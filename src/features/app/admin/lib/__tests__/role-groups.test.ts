import { describe, expect, it } from "vitest";

import {
  chipsHeld,
  dbRolesFor,
  DRIVER_FILE_ROLES,
  MANAGEABLE_ROLES,
} from "../role-groups";

describe("dbRolesFor", () => {
  it("maps every chip to exactly its own role — driver and carrier are two roles, not one", () => {
    for (const role of MANAGEABLE_ROLES) {
      expect(dbRolesFor(role)).toEqual([role]);
    }
  });
});

describe("chipsHeld", () => {
  it("lights up the in-house driver chip from driver alone", () => {
    expect(chipsHeld(["shipper", "driver"])).toEqual(["driver"]);
  });

  it("lights up the carrier chip from carrier alone", () => {
    expect(chipsHeld(["shipper", "carrier"])).toEqual(["carrier"]);
  });

  it("shows both chips for an account that holds both (approved before the split)", () => {
    expect(chipsHeld(["shipper", "carrier", "driver"])).toEqual(["driver", "carrier"]);
  });

  it("never lights up a chip for shipper — it grants nothing to manage", () => {
    expect(chipsHeld(["shipper"])).toEqual([]);
  });

  it("returns every manageable role an account holds, in canonical order", () => {
    expect(
      chipsHeld(["admin", "shipper", "carrier", "driver", "finance"])
    ).toEqual(["driver", "carrier", "finance", "admin"]);
  });

  it("returns nothing held for an account with no manageable role", () => {
    expect(chipsHeld([])).toEqual([]);
  });
});

describe("DRIVER_FILE_ROLES", () => {
  it("names the two roles that come with a driver file, and both are manageable", () => {
    expect([...DRIVER_FILE_ROLES]).toEqual(["driver", "carrier"]);
    for (const role of DRIVER_FILE_ROLES) expect(MANAGEABLE_ROLES).toContain(role);
  });
});
