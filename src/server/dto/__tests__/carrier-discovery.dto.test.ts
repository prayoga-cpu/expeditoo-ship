import { describe, it, expect } from "vitest";
import {
  carrierMatchSchema,
  carrierMatchListSchema,
} from "../carrier-discovery.dto";

// Covers docs/specs/carriers_on_route_spec.md §4.3 — the projection a requester
// receives, and everything it must never carry.
//
// The service parses the *whole* DAL row through `carrierMatchSchema`, so this
// schema is the privacy boundary rather than a formality: whatever it does not
// name is dropped. These tests are written to fail loudly the day a tenth field
// is added, because a tenth field is a spec change and not an implementation
// detail.

/** The nine fields of §4.3, and no others. */
const ALLOWED = [
  "avatarUrl",
  "destinationCity",
  "detourKm",
  "displayName",
  "matchId",
  "nextRuns",
  "originCity",
  "rating",
  "reviewCount",
] as const;

/**
 * Named one by one rather than derived, so removing a column from the DAL read
 * does not quietly remove the assertion that it stays off the wire.
 */
const FORBIDDEN = [
  "userId",
  "carrierId",
  "routeId",
  "originAddress",
  "destinationAddress",
  "originPostalCode",
  "destinationPostalCode",
  "originLat",
  "originLng",
  "destinationLat",
  "destinationLng",
  "radiusKm",
  "capacityKg",
  "vehicleId",
  "vehicle",
  "plateNumber",
  "siret",
  "userName",
  "userImage",
  "averageRating",
  "totalRatings",
  "kind",
  "daysOfWeek",
  "validFrom",
  "validUntil",
  "dates",
  "isDiscoverable",
  "isActive",
  "notifyOnMatch",
] as const;

/**
 * A match row as the service hands it over: the projection spread on top of the
 * full prefilter row, private columns and all.
 */
const RICH_ROW = {
  // The projection (§4.3).
  matchId: "route-1",
  displayName: "Faissal B.",
  avatarUrl: null,
  rating: 5,
  reviewCount: 1,
  originCity: "Vannes",
  destinationCity: "Montrouge",
  nextRuns: ["2026-09-08T00:00:00.000Z"],
  detourKm: 3,

  // Everything else `findMatchCandidates` reads, plus columns a later change
  // could plausibly add to it.
  routeId: "route-1",
  carrierId: "carrier-1",
  userId: "user-1",
  userName: "Faissal Benali",
  userImage: "https://cdn.example.test/avatar.jpg",
  averageRating: 5,
  totalRatings: 1,
  kind: "recurring",
  daysOfWeek: [2, 4],
  validFrom: null,
  validUntil: null,
  dates: [],
  originAddress: "12 rue du Port",
  originPostalCode: "56000",
  originLat: 47.658,
  originLng: -2.76,
  destinationAddress: "3 avenue de la République",
  destinationPostalCode: "92120",
  destinationLat: 48.818,
  destinationLng: 2.318,
  radiusKm: 40,
  capacityKg: 800,
  vehicleId: "vehicle-1",
  vehicle: { id: "vehicle-1", plateNumber: "AA-123-BB" },
  plateNumber: "AA-123-BB",
  siret: "81234567800017",
  isDiscoverable: true,
  isActive: true,
  notifyOnMatch: false,
};

describe("carrierMatchSchema", () => {
  it("yields exactly the nine fields of §4.3", () => {
    const parsed = carrierMatchSchema.parse(RICH_ROW);

    expect(Object.keys(parsed).sort()).toEqual([...ALLOWED]);
  });

  it("drops every private column the prefilter row carries", () => {
    const parsed: Record<string, unknown> = carrierMatchSchema.parse(RICH_ROW);

    for (const field of FORBIDDEN) {
      expect(parsed).not.toHaveProperty(field);
    }
  });

  it("never lets a user id reach the wire", () => {
    const parsed = carrierMatchSchema.parse(RICH_ROW);

    // The one field §4.3 puts above all the others: contact is by `matchId`,
    // and the carrier's user id is resolved server-side (§6.2).
    expect(Object.values(parsed)).not.toContain(RICH_ROW.userId);
    expect(JSON.stringify(parsed)).not.toContain("user-1");
  });

  it("carries cities but no address, postal code or coordinate", () => {
    const serialised = JSON.stringify(carrierMatchSchema.parse(RICH_ROW));

    expect(serialised).toContain("Vannes");
    expect(serialised).toContain("Montrouge");
    expect(serialised).not.toContain("rue du Port");
    expect(serialised).not.toContain("56000");
    expect(serialised).not.toContain("47.658");
  });

  it("accepts a carrier with no avatar", () => {
    expect(carrierMatchSchema.parse(RICH_ROW).avatarUrl).toBeNull();
  });

  it("rejects a row missing any of the nine", () => {
    for (const field of ALLOWED) {
      const partial: Record<string, unknown> = { ...RICH_ROW };
      delete partial[field];

      expect(() => carrierMatchSchema.parse(partial)).toThrow();
    }
  });

  it("rejects an avatar that is neither a string nor null", () => {
    expect(() =>
      carrierMatchSchema.parse({ ...RICH_ROW, avatarUrl: 42 })
    ).toThrow();
  });

  it("keeps the run dates as ISO strings, soonest first", () => {
    const parsed = carrierMatchSchema.parse({
      ...RICH_ROW,
      nextRuns: [
        "2026-09-08T00:00:00.000Z",
        "2026-09-10T00:00:00.000Z",
        "2026-09-15T00:00:00.000Z",
      ],
    });

    expect(parsed.nextRuns).toEqual([
      "2026-09-08T00:00:00.000Z",
      "2026-09-10T00:00:00.000Z",
      "2026-09-15T00:00:00.000Z",
    ]);
  });
});

describe("carrierMatchListSchema", () => {
  it("parses a page of matches", () => {
    const parsed = carrierMatchListSchema.parse({
      items: [RICH_ROW],
      total: 14,
    });

    expect(parsed.total).toBe(14);
    expect(Object.keys(parsed.items[0]).sort()).toEqual([...ALLOWED]);
  });

  it("accepts an empty pool", () => {
    expect(carrierMatchListSchema.parse({ items: [], total: 0 })).toEqual({
      items: [],
      total: 0,
    });
  });

  it("refuses a total that is not a whole count of carriers", () => {
    expect(() =>
      carrierMatchListSchema.parse({ items: [], total: -1 })
    ).toThrow();
    expect(() =>
      carrierMatchListSchema.parse({ items: [], total: 1.5 })
    ).toThrow();
  });
});
