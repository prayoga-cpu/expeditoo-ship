import { describe, it, expect } from "vitest";
import {
  CANCELLATION_CATEGORIES,
  CANCELLATION_SIDES,
  CATEGORIES_BY_SIDE,
  canCancelAs,
  canWithdrawAs,
  categoriesForSide,
  isCategoryForSide,
  requiresSupport,
  sideFor,
  type CancellationParty,
  type CancellationSide,
} from "../cancellation-policy";

// ========================================
// Which side a viewer is on
// ========================================
//
// The party says what someone is to a shipment; the side says what they are
// commercially. Only the inlet separates them, and getting that wrong on the
// escalated inlet hands the Expedion system account a requester's powers.

describe("sideFor", () => {
  const cases: Array<[CancellationParty, "direct" | "expedion", CancellationSide]> = [
    ["shipper", "direct", "requester"],
    // The `shipper` seat on an escalated job is the system account nobody signs
    // into. It is never the requester — the real one is the quote owner.
    ["shipper", "expedion", "operator"],
    ["carrier", "direct", "transporter"],
    ["carrier", "expedion", "transporter"],
    ["driver", "direct", "transporter"],
    ["driver", "expedion", "transporter"],
    ["staff", "direct", "operator"],
    ["staff", "expedion", "operator"],
  ];

  it.each(cases)("%s on a %s job is the %s", (party, origin, side) => {
    expect(sideFor(party, origin)).toBe(side);
  });

  it("puts a carrier and its employed driver on the same side", () => {
    // They are one commercial party, which is why the side is not `actor_role`.
    expect(sideFor("carrier", "direct")).toBe(sideFor("driver", "direct"));
  });
});

// ========================================
// Cancelling — ending the job
// ========================================

describe("canCancelAs", () => {
  it("lets a requester call the job off before anything is collected", () => {
    expect(canCancelAs("requester", "PENDING")).toBe(true);
    expect(canCancelAs("requester", "ASSIGNED")).toBe(true);
  });

  it("stops a requester once the goods are in a vehicle", () => {
    expect(canCancelAs("requester", "PICKED_UP")).toBe(false);
    expect(canCancelAs("requester", "IN_TRANSIT")).toBe(false);
  });

  it("never lets a transporter end a client's paid job", () => {
    for (const status of ["PENDING", "ASSIGNED", "PICKED_UP", "IN_TRANSIT"]) {
      expect(canCancelAs("transporter", status)).toBe(false);
    }
  });

  it("lets an operator end a run that is already on the road", () => {
    // The product has promised this since day one and could not do it: the
    // staff carve-out was defeated by a transition table with no CANCELLED edge
    // out of IN_TRANSIT.
    expect(canCancelAs("operator", "PICKED_UP")).toBe(true);
    expect(canCancelAs("operator", "IN_TRANSIT")).toBe(true);
  });

  it("refuses a delivered run to everyone, operators included", () => {
    // A payout row and an invoice already exist and there is no clawback.
    for (const side of CANCELLATION_SIDES) {
      expect(canCancelAs(side, "DELIVERED")).toBe(false);
    }
  });

  it("refuses a run that is already off", () => {
    for (const side of CANCELLATION_SIDES) {
      expect(canCancelAs(side, "CANCELLED")).toBe(false);
    }
  });
});

// ========================================
// Withdrawing — coming off the job
// ========================================

describe("canWithdrawAs", () => {
  it("lets a transporter hand the job back before pickup", () => {
    expect(canWithdrawAs("transporter", "PENDING")).toBe(true);
    expect(canWithdrawAs("transporter", "ASSIGNED")).toBe(true);
  });

  it("refuses once the cargo is loaded", () => {
    // Offering a job to the board while its cargo sits in someone's van is a
    // lie, whoever is asking.
    expect(canWithdrawAs("transporter", "PICKED_UP")).toBe(false);
    expect(canWithdrawAs("transporter", "IN_TRANSIT")).toBe(false);
    expect(canWithdrawAs("operator", "PICKED_UP")).toBe(false);
  });

  it("is not a verb the requester has", () => {
    // Handing your own job back to the board is just cancelling it.
    for (const status of ["PENDING", "ASSIGNED", "PICKED_UP"]) {
      expect(canWithdrawAs("requester", status)).toBe(false);
    }
  });
});

describe("requiresSupport", () => {
  it("is what the client-facing copy has always promised", () => {
    expect(requiresSupport("requester", "PICKED_UP")).toBe(true);
    expect(requiresSupport("transporter", "IN_TRANSIT")).toBe(true);
  });

  it("is never true of the operator who *is* the support", () => {
    expect(requiresSupport("operator", "PICKED_UP")).toBe(false);
    expect(requiresSupport("operator", "IN_TRANSIT")).toBe(false);
  });

  it("does not fire before anything has been collected", () => {
    expect(requiresSupport("requester", "ASSIGNED")).toBe(false);
  });
});

// ========================================
// The per-side fence
// ========================================

describe("categoriesForSide", () => {
  it("accounts for every category the enum has", () => {
    // A value nothing can ever pick is a column that will never be populated
    // and a translation nobody will ever see.
    const fenced = new Set(CANCELLATION_SIDES.flatMap((s) => [...CATEGORIES_BY_SIDE[s]]));
    expect([...fenced].sort()).toEqual([...CANCELLATION_CATEGORIES].sort());
  });

  it("gives every side an escape hatch", () => {
    // A taxonomy with no `other` teaches people to pick the nearest wrong value.
    for (const side of CANCELLATION_SIDES) {
      expect(categoriesForSide(side)).toContain("other");
    }
  });

  it("keeps a driver's reasons out of the client's list, and vice versa", () => {
    expect(isCategoryForSide("transporter", "vehicle_breakdown")).toBe(true);
    expect(isCategoryForSide("requester", "vehicle_breakdown")).toBe(false);
    expect(isCategoryForSide("requester", "no_longer_needed")).toBe(true);
    expect(isCategoryForSide("transporter", "no_longer_needed")).toBe(false);
  });

  it("keeps the two blame-shifting reasons on the transporter's list", () => {
    // The driver presses the button, but the cause is the client's description
    // or the pickup site. Named separately so a reliability count can decline
    // to charge them to the driver.
    expect(isCategoryForSide("transporter", "cargo_mismatch")).toBe(true);
    expect(isCategoryForSide("transporter", "access_impossible")).toBe(true);
  });

  it("reserves the operator's reasons for operators", () => {
    expect(isCategoryForSide("operator", "no_driver_found")).toBe(true);
    expect(isCategoryForSide("requester", "no_driver_found")).toBe(false);
    expect(isCategoryForSide("transporter", "support_resolution")).toBe(false);
  });
});
