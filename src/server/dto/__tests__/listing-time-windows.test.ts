import { describe, expect, it } from "vitest";

import { MATERIAL_FIELDS, createListingSchema } from "@/server/dto/listings.dto";

/** client feedback 2026-11-06, A01: optional exact hours at each end of a request. */

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
  title: "Two-seater sofa",
  description: "A sofa and a coffee table, ground floor at both ends.",
  weightKg: 80,
  pickup: endpoint(),
  dropoff: endpoint({ lat: 43.3, lng: 5.37, city: "Marseille", postalCode: "13001" }),
  pickupFrom: "2026-10-05T06:00:00.000Z",
  pickupUntil: "2026-10-09T20:00:00.000Z",
  dropoffFrom: "2026-10-10T06:00:00.000Z",
  dropoffUntil: "2026-10-12T20:00:00.000Z",
  isFlexible: true,
  budgetCents: 25_000,
  ...over,
});

const messages = (input: unknown): string[] => {
  const result = createListingSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => i.message);
};

describe("exact hours at an end", () => {
  it("a request without hours behaves exactly as before", () => {
    expect(messages(payload())).toEqual([]);
  });

  it("accepts 09:00–12:00 at the pickup", () => {
    const parsed = createListingSchema.parse(
      payload({ pickupTimeFrom: "09:00", pickupTimeTo: "12:00" })
    );
    expect(parsed.pickupTimeFrom).toBe("09:00");
    expect(parsed.pickupTimeTo).toBe("12:00");
  });

  it("refuses an end that is not after its start", () => {
    expect(messages(payload({ dropoffTimeFrom: "14:00", dropoffTimeTo: "14:00" }))).toContain(
      "TIME_WINDOW_ORDER"
    );
    expect(messages(payload({ dropoffTimeFrom: "14:00", dropoffTimeTo: "09:00" }))).toContain(
      "TIME_WINDOW_ORDER"
    );
  });

  it("refuses half a window", () => {
    expect(messages(payload({ pickupTimeFrom: "09:00" }))).toContain("TIME_WINDOW_INCOMPLETE");
    expect(messages(payload({ pickupTimeTo: "12:00" }))).toContain("TIME_WINDOW_INCOMPLETE");
  });

  it("refuses a time that is not a clock time", () => {
    expect(messages(payload({ pickupTimeFrom: "25:00", pickupTimeTo: "26:00" }))).toContain(
      "INVALID_TIME"
    );
    expect(messages(payload({ pickupTimeFrom: "9h", pickupTimeTo: "12:00" }))).toContain("INVALID_TIME");
  });

  it("counts them as fields a carrier prices on", () => {
    for (const field of ["pickupTimeFrom", "pickupTimeTo", "dropoffTimeFrom", "dropoffTimeTo"]) {
      expect(MATERIAL_FIELDS).toContain(field);
    }
  });
});

describe("an illustration standing in for a photo (client feedback 2026-11-06, A07)", () => {
  it("is accepted on a request with no photo", () => {
    expect(createListingSchema.parse(payload({ illustration: "furniture" })).illustration).toBe(
      "furniture"
    );
  });

  it("is refused beside a real photo", () => {
    expect(
      messages(payload({ illustration: "parcel", photos: ["https://cdn.example.com/a.jpg"] }))
    ).toContain("ILLUSTRATION_WITH_PHOTOS");
  });

  it("is refused when it is not one of the four", () => {
    expect(messages(payload({ illustration: "dragon" })).length).toBeGreaterThan(0);
  });

  it("is never the default: a request without it carries none", () => {
    expect(createListingSchema.parse(payload()).illustration).toBeUndefined();
  });
});
