import { describe, expect, it } from "vitest";

import {
  MATERIAL_FIELDS,
  createListingSchema,
} from "@/server/dto/listings.dto";

/**
 * request_availability_spec.md §3: the weekdays and times of day at each end
 * of a request, as the API accepts them.
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

describe("createListingSchema availability", () => {
  it("leaves all four absent when the request names none", () => {
    const parsed = createListingSchema.parse(payload());

    expect(parsed.pickupDays).toBeUndefined();
    expect(parsed.dropoffPeriods).toBeUndefined();
  });

  it("puts weekdays and times of day in their canonical order", () => {
    const parsed = createListingSchema.parse(
      payload({ pickupDays: [5, 1, 3], pickupPeriods: ["evening", "morning"] })
    );

    expect(parsed.pickupDays).toEqual([1, 3, 5]);
    expect(parsed.pickupPeriods).toEqual(["morning", "evening"]);
  });

  it("refuses a weekday or a time of day named twice", () => {
    expect(messages(payload({ pickupDays: [1, 1] }))).toContain("DUPLICATE_WEEKDAY");
    expect(messages(payload({ dropoffPeriods: ["morning", "morning"] }))).toContain(
      "DUPLICATE_PERIOD"
    );
  });

  it("refuses an empty set, a weekday outside 1–7 and an unknown time of day", () => {
    expect(createListingSchema.safeParse(payload({ pickupDays: [] })).success).toBe(false);
    expect(createListingSchema.safeParse(payload({ pickupDays: [0] })).success).toBe(false);
    expect(createListingSchema.safeParse(payload({ pickupDays: [8] })).success).toBe(false);
    expect(
      createListingSchema.safeParse(payload({ pickupPeriods: ["night"] })).success
    ).toBe(false);
  });

  it("refuses a narrowed set on an exact request", () => {
    expect(
      messages(payload({ isFlexible: false, pickupDays: [1, 2, 3, 4, 5] }))
    ).toContain("AVAILABILITY_REQUIRES_FLEXIBLE");
  });

  it("accepts the full sets on an exact request — what the form sends", () => {
    expect(
      createListingSchema.safeParse(
        payload({
          isFlexible: false,
          pickupDays: [1, 2, 3, 4, 5, 6, 7],
          pickupPeriods: ["morning", "afternoon", "evening"],
          dropoffDays: [1, 2, 3, 4, 5, 6, 7],
          dropoffPeriods: ["morning", "afternoon", "evening"],
        })
      ).success
    ).toBe(true);
  });

  it("counts them, and the flexible flag, as fields a carrier prices on", () => {
    for (const field of [
      "isFlexible",
      "pickupDays",
      "pickupPeriods",
      "dropoffDays",
      "dropoffPeriods",
    ]) {
      expect(MATERIAL_FIELDS).toContain(field);
    }
  });
});
