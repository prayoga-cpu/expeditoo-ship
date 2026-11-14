import { describe, expect, it } from "vitest";

import { routeStops, routeTowns, stopLine, townLine } from "../route-label";

// route_towns_and_blank_streets_spec.md §2
const run = {
  pickupAddress: "13 RUE DU DEPART",
  dropoffAddress: "15 quai François Ier",
  listing: {
    pickupCity: "Marseille",
    pickupPostalCode: "13000",
    dropoffCity: "Bayonne",
    dropoffPostalCode: "64000",
  },
};

describe("townLine / stopLine", () => {
  it("joins what exists and nothing else", () => {
    expect(townLine("64000", "Bayonne")).toBe("64000 Bayonne");
    expect(townLine(null, "Bayonne")).toBe("Bayonne");
    expect(townLine("", "")).toBe("");
    expect(stopLine("15 quai", "64000", "Bayonne")).toBe("15 quai, 64000 Bayonne");
  });

  it("leaves no dangling comma when the street was never typed", () => {
    expect(stopLine("", "64000", "Bayonne")).toBe("64000 Bayonne");
    expect(stopLine("  ", "64000", "Bayonne")).toBe("64000 Bayonne");
  });
});

describe("routeTowns", () => {
  it("reads the towns from the listing", () => {
    expect(routeTowns(run)).toEqual({ from: "Marseille", to: "Bayonne" });
  });

  it("falls back to the street when the listing carries no town", () => {
    expect(routeTowns({ ...run, listing: null })).toEqual({
      from: "13 RUE DU DEPART",
      to: "15 quai François Ier",
    });
  });
});

describe("routeStops", () => {
  it("puts the town after the street, for a card that wraps", () => {
    expect(routeStops(run)).toEqual({
      from: "13 RUE DU DEPART, 13000 Marseille",
      to: "15 quai François Ier, 64000 Bayonne",
    });
  });

  it("is never blank for a request posted with a town and no street", () => {
    expect(routeStops({ ...run, dropoffAddress: "" }).to).toBe("64000 Bayonne");
  });
});
