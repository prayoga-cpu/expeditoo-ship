import { describe, it, expect } from "vitest";
import {
  MAX_LEGAL_FORM_CHARS,
  carrierMatchSchema,
  carrierMatchListSchema,
} from "../carrier-discovery.dto";

// Covers docs/specs/carriers_on_route_spec.md §4.3 — the projection a requester
// receives, and everything it must never carry.
//
// The service parses the *whole* DAL row through `carrierMatchSchema`, so this
// schema is the privacy boundary rather than a formality: whatever it does not
// name is dropped. These tests are written to fail loudly the day an eleventh
// field is added, because a field on this projection is a spec change and not
// an implementation detail.
//
// `legalForm` is the tenth, and it was added through exactly that door: §4.4
// argues why a business's own legal form is disclosable where an address, a
// SIRET or a user id is not. The key-set assertions below are what made that
// argument happen rather than be skipped.

/** The ten fields of §4.3, and no others. */
const ALLOWED = [
  "avatarUrl",
  "destinationCity",
  "detourKm",
  "displayName",
  "legalForm",
  "matchId",
  "nextRuns",
  "originCity",
  "rating",
  "reviewCount",
] as const;

/**
 * The nine a row must actually carry.
 *
 * `legalForm` is absent from this list on purpose: a carrier who never declared
 * one, and a DAL read that does not select the column, must both cost a badge
 * rather than the whole list (§4.4).
 */
const REQUIRED = ALLOWED.filter((field) => field !== "legalForm");

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
  "vatNumber",
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
  legalForm: "SASU",
  originCity: "Vannes",
  destinationCity: "Montrouge",
  nextRuns: ["2026-09-08"],
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
  vatNumber: "FR40812345678",
  isDiscoverable: true,
  isActive: true,
  notifyOnMatch: false,
};

describe("carrierMatchSchema", () => {
  it("yields exactly the ten fields of §4.3", () => {
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

  it("rejects a row missing any of the nine it requires", () => {
    for (const field of REQUIRED) {
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

  it("keeps the run days in the order it was given, soonest first", () => {
    // Calendar days, not instants: a trajet runs on a day, and `toISOString()`
    // on the local midnight the service holds names the previous one anywhere
    // east of UTC (§4.3, §8).
    const parsed = carrierMatchSchema.parse({
      ...RICH_ROW,
      nextRuns: ["2026-09-08", "2026-09-10", "2026-09-15"],
    });

    expect(parsed.nextRuns).toEqual(["2026-09-08", "2026-09-10", "2026-09-15"]);
  });
});

// The tenth field of §4.3, and the only one on this projection that is free
// text a human typed. §4.4 is the argument for exposing it; these are the
// bounds that make it safe to render.
describe("carrierMatchSchema — legalForm", () => {
  const legalForm = (value: unknown) =>
    carrierMatchSchema.parse({ ...RICH_ROW, legalForm: value }).legalForm;

  it("carries the legal form a carrier actually declared", () => {
    expect(legalForm("SASU")).toBe("SASU");
    expect(legalForm("auto-entrepreneur")).toBe("auto-entrepreneur");
  });

  it("says nothing at all when the carrier never declared one", () => {
    // `null`, not « Particulier ». An empty column means *not stated*, and
    // guessing an answer from it is a claim the data cannot support (§4.5).
    expect(legalForm(null)).toBeNull();
  });

  it("reads an empty or whitespace entry as not stated", () => {
    expect(legalForm("")).toBeNull();
    expect(legalForm("   ")).toBeNull();
    expect(legalForm("\n\t")).toBeNull();
  });

  it("trims what a carrier typed rather than rendering their spacing", () => {
    expect(legalForm("  SARL  ")).toBe("SARL");
  });

  it("survives a row whose read did not select the column", () => {
    const partial: Record<string, unknown> = { ...RICH_ROW };
    delete partial.legalForm;

    const parsed = carrierMatchSchema.parse(partial);

    // The key is still there, so a client never has to distinguish "absent"
    // from "not stated" — and narrowing a `select` costs a badge, not a 500 on
    // the only surface that reaches the supply pool.
    expect(parsed).toHaveProperty("legalForm", null);
  });

  it("carries a spelled-out legal form whole", () => {
    // The bound exists against an import or an admin edit, not against the KYC
    // form the product gives a carrier, which accepts 100 characters. A cap
    // sized for abbreviations would clip these mid-word (§4.4).
    expect(legalForm("société par actions simplifiée unipersonnelle")).toBe(
      "société par actions simplifiée unipersonnelle"
    );
    expect(
      legalForm("entreprise unipersonnelle à responsabilité limitée")
    ).toBe("entreprise unipersonnelle à responsabilité limitée");
  });

  it("bounds a long entry instead of refusing the whole card", () => {
    const rant = "société à responsabilité limitée ".repeat(20);

    const parsed = legalForm(rant);

    expect(parsed).not.toBeNull();
    expect(parsed?.length).toBe(MAX_LEGAL_FORM_CHARS);
    // One carrier's typing may not take every other card down with it: the
    // parse truncates where it could have thrown — and marks the cut, so a
    // clipped value never reads as a complete declaration.
    expect(parsed?.endsWith("…")).toBe(true);
    expect(rant.startsWith(parsed?.slice(0, -1) ?? "")).toBe(true);
  });

  it("bounds the projection even when the whole list is parsed", () => {
    const parsed = carrierMatchListSchema.parse({
      items: [{ ...RICH_ROW, legalForm: "x".repeat(500) }],
      total: 1,
    });

    expect(parsed.items[0].legalForm).toHaveLength(MAX_LEGAL_FORM_CHARS);
  });

  it("does not open the door to the rest of the carrier row", () => {
    // Disclosing the legal form is not disclosing the company file: `siret`
    // pulls the registered address out of SIRENE, and for an auto-entrepreneur
    // that address is their home (§4.4).
    const serialised = JSON.stringify(carrierMatchSchema.parse(RICH_ROW));

    expect(serialised).toContain("SASU");
    expect(serialised).not.toContain("81234567800017");
    expect(serialised).not.toContain("FR40812345678");
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
