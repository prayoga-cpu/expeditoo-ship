import { describe, expect, it } from "vitest";

import {
  createListingSchema,
  updateListingSchema,
} from "@/server/dto/listings.dto";

/**
 * listing_reference_spec.md §2: the sequence is the reference's only writer.
 * A client that sends one has it dropped at the boundary, like any key the
 * contract does not name — the same reason `origin` is not on it.
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
  pickupFrom: "2026-10-05T08:00:00.000Z",
  pickupUntil: "2026-10-05T16:00:00.000Z",
  dropoffFrom: "2026-10-06T08:00:00.000Z",
  dropoffUntil: "2026-10-06T16:00:00.000Z",
  budgetCents: 25_000,
  ...over,
});

describe("the job reference is not client input", () => {
  it("drops a reference sent with a new request", () => {
    const parsed = createListingSchema.parse(payload({ reference: 100001 }));

    expect(parsed).not.toHaveProperty("reference");
  });

  it("drops a reference sent with an edit", () => {
    const parsed = updateListingSchema.parse({ reference: 100001 });

    expect(parsed).not.toHaveProperty("reference");
  });
});
