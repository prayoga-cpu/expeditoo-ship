import { describe, expect, it } from "vitest";

import { MATERIAL_FIELDS, createListingSchema } from "@/server/dto/listings.dto";

/**
 * client_feedback_2026_10_31_spec.md §2.3, §3, §6.3 — a move, its floors, and
 * the country at each end, as the API holds them.
 */

const endpoint = (over: Record<string, unknown> = {}) => ({
  lat: 45.75,
  lng: 4.85,
  address: "12 rue A",
  city: "Lyon",
  postalCode: "69003",
  locationType: "house",
  ...over,
});

const payload = (over: Record<string, unknown> = {}) => ({
  title: "Déménagement · 65 m²",
  weightKg: 4875,
  pickup: endpoint({ floor: 0 }),
  dropoff: endpoint({ lat: 43.3, lng: 5.37, city: "Marseille", postalCode: "13001", floor: 2, hasLift: true }),
  pickupFrom: "2026-11-05T08:00:00.000Z",
  pickupUntil: "2026-11-05T16:00:00.000Z",
  dropoffFrom: "2026-11-06T08:00:00.000Z",
  dropoffUntil: "2026-11-06T16:00:00.000Z",
  budgetCents: 90_000,
  jobKind: "moving",
  movingSurfaceM2: 65,
  ...over,
});

const messages = (input: unknown): string[] => {
  const result = createListingSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => i.message);
};

describe("createListingSchema — a move", () => {
  it("accepts a move sized by its surface", () => {
    expect(messages(payload())).toEqual([]);
  });

  it("accepts a move sized by its volume", () => {
    expect(messages(payload({ movingSurfaceM2: undefined, movingVolumeM3: 30.5 }))).toEqual([]);
  });

  it("wants exactly one size", () => {
    expect(messages(payload({ movingSurfaceM2: undefined }))).toContain("MOVING_SIZE_REQUIRED");
    expect(messages(payload({ movingVolumeM3: 30 }))).toContain("MOVING_SIZE_REQUIRED");
  });

  it("refuses a size on items", () => {
    expect(messages(payload({ jobKind: "items" }))).toContain("MOVING_SIZE_ON_ITEMS");
    expect(messages(payload({ jobKind: undefined }))).toContain("MOVING_SIZE_ON_ITEMS");
  });

  it("holds the sizes to their range", () => {
    expect(messages(payload({ movingSurfaceM2: 2 })).length).toBeGreaterThan(0);
    expect(messages(payload({ movingSurfaceM2: 65.5 })).length).toBeGreaterThan(0);
    expect(
      messages(payload({ movingSurfaceM2: undefined, movingVolumeM3: 900 })).length
    ).toBeGreaterThan(0);
  });

  it("asks a house its floor on a move, and not on items", () => {
    const houseNoFloor = endpoint({ lat: 43.3, lng: 5.37, city: "Marseille", postalCode: "13001" });

    expect(messages(payload({ dropoff: houseNoFloor }))).toContain("FLOOR_REQUIRED");
    expect(
      messages(payload({ dropoff: houseNoFloor, jobKind: "items", movingSurfaceM2: undefined }))
    ).toEqual([]);
  });

  it("asks the lift from the first floor up", () => {
    const upstairs = endpoint({ lat: 43.3, lng: 5.37, city: "Marseille", postalCode: "13001", floor: 3 });

    expect(messages(payload({ dropoff: upstairs }))).toContain("LIFT_REQUIRED");
  });

  it("counts the kind and the sizes among what carriers price", () => {
    expect(MATERIAL_FIELDS).toEqual(
      expect.arrayContaining(["jobKind", "movingSurfaceM2", "movingVolumeM3"])
    );
  });
});

describe("createListingSchema — apartments", () => {
  const items = (dropoff: Record<string, unknown>) =>
    payload({ jobKind: "items", movingSurfaceM2: undefined, dropoff });

  it("no longer asks a ground-floor apartment about a lift", () => {
    const flat = endpoint({ lat: 43.3, lng: 5.37, city: "Marseille", postalCode: "13001", locationType: "apartment", floor: 0 });

    expect(messages(items(flat))).toEqual([]);
  });

  it("still asks an apartment its floor, and an upstairs one its lift", () => {
    const noFloor = endpoint({ lat: 43.3, lng: 5.37, city: "Marseille", postalCode: "13001", locationType: "apartment" });
    const upstairs = { ...noFloor, floor: 4 };

    expect(messages(items(noFloor))).toContain("APARTMENT_FLOOR_REQUIRED");
    expect(messages(items(upstairs))).toContain("APARTMENT_LIFT_REQUIRED");
  });
});

describe("createListingSchema — countries", () => {
  it("holds a pin to its end's country", () => {
    const brussels = endpoint({ lat: 50.85, lng: 4.35, city: "Bruxelles", postalCode: "1000", country: "BE" });

    expect(messages(payload({ dropoff: { ...brussels, floor: 0 } }))).toEqual([]);
    // Berlin as French. Not Brussels: France's box has always taken in
    // Belgium and Luxembourg, and the form's reverse geocoding — not this
    // box — is what catches a pin a few kilometres over a border.
    const berlin = endpoint({ lat: 52.52, lng: 13.405, city: "Berlin", postalCode: "10115", country: "FR", floor: 0 });
    expect(messages(payload({ dropoff: berlin }))).toContain("LOCATION_OUT_OF_COUNTRY");
  });

  it("refuses a lowercase or unknown code", () => {
    expect(messages(payload({ dropoff: endpoint({ country: "be", floor: 0 }) }))).toContain(
      "UNSUPPORTED_COUNTRY"
    );
  });
});
