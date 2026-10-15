import { describe, expect, it } from "vitest";

import { createListingSchema } from "@/server/dto/listings.dto";

/**
 * client_feedback_2026_10_spec.md §8: « Détails » is optional on `/create`, so
 * the API takes a request without one. The column is NOT NULL, so an absent
 * description reaches the service as "".
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
  title: "Canapé deux places",
  weightKg: 60,
  pickup: endpoint(),
  dropoff: endpoint({ lat: 43.3, lng: 5.37, city: "Marseille", postalCode: "13001" }),
  pickupFrom: "2026-10-05T08:00:00.000Z",
  pickupUntil: "2026-10-05T16:00:00.000Z",
  dropoffFrom: "2026-10-06T08:00:00.000Z",
  dropoffUntil: "2026-10-06T16:00:00.000Z",
  budgetCents: 25_000,
  ...over,
});

describe("createListingSchema description", () => {
  it("defaults a missing description to an empty string", () => {
    const parsed = createListingSchema.parse(payload());
    expect(parsed.description).toBe("");
  });

  it("takes an empty or a short one", () => {
    expect(createListingSchema.safeParse(payload({ description: "" })).success).toBe(true);
    expect(createListingSchema.safeParse(payload({ description: "Hi" })).success).toBe(true);
  });

  it("still refuses one over 5000 characters", () => {
    expect(
      createListingSchema.safeParse(payload({ description: "x".repeat(5001) })).success
    ).toBe(false);
  });
});
