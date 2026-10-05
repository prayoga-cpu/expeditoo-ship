import { describe, expect, it } from "vitest";

import { MAX_QUANTITY, createListingSchema } from "@/server/dto/listings.dto";

/**
 * numeric_input_spec.md §8: the API counts no more items than the form's
 * quantity box can, so a caller of the API is refused what the form refuses.
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

const payload = (quantity: number) => ({
  title: "Folding chairs",
  description: "Stacked folding chairs, on pallets, ground floor at both ends.",
  weightKg: 900,
  quantity,
  pickup: endpoint(),
  dropoff: endpoint({ lat: 43.3, lng: 5.37, city: "Marseille", postalCode: "13001" }),
  pickupFrom: "2026-10-05T08:00:00.000Z",
  pickupUntil: "2026-10-05T16:00:00.000Z",
  dropoffFrom: "2026-10-06T08:00:00.000Z",
  dropoffUntil: "2026-10-06T16:00:00.000Z",
  budgetCents: 25_000,
});

describe("createListingSchema quantity", () => {
  it("takes up to the ceiling the form's box reaches", () => {
    expect(MAX_QUANTITY).toBe(99_999);
    expect(createListingSchema.safeParse(payload(1_200)).success).toBe(true);
    expect(createListingSchema.safeParse(payload(MAX_QUANTITY)).success).toBe(true);
  });

  it("refuses one more", () => {
    expect(createListingSchema.safeParse(payload(MAX_QUANTITY + 1)).success).toBe(false);
  });
});
