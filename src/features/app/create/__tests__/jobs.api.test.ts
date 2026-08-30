import { describe, expect, it } from "vitest";

import { SIZE_PRESET_DIMENSIONS } from "../cargo";
import type { JobFormOutput } from "../schemas";
import { toCreatePayload } from "../api/jobs.api";

/**
 * `toCreatePayload` is the only seam that had to move when weight became a
 * bracket: `createListingSchema` still wants one number and three dimensions,
 * and it is here that a choice becomes them. If this drifts, the form starts
 * posting work the API rejects with a code the form has no message for.
 */
const endpoint = {
  lat: 45.75,
  lng: 4.85,
  address: "12 rue A",
  city: "Lyon",
  postalCode: "69003",
  locationType: "house" as const,
};

const values = (over: Partial<JobFormOutput> = {}): JobFormOutput =>
  ({
    title: "Two-seater sofa",
    description: "A sofa and a coffee table, ground floor at both ends.",
    weightBracket: "upTo100",
    sizeMode: "preset",
    quantity: 1,
    isFragile: false,
    needsHelp: false,
    isFlexible: false,
    photos: [],
    pickup: endpoint,
    dropoff: { ...endpoint, city: "Marseille", postalCode: "13001" },
    pickupFrom: new Date("2026-09-01T08:00:00Z"),
    pickupUntil: new Date("2026-09-01T16:00:00Z"),
    dropoffFrom: new Date("2026-09-02T08:00:00Z"),
    dropoffUntil: new Date("2026-09-02T16:00:00Z"),
    budgetEuros: 250,
    ...over,
  }) as JobFormOutput;

describe("toCreatePayload", () => {
  it("sends the bracket's ceiling as the weight", () => {
    expect(toCreatePayload(values(), true).weightKg).toBe(100);
  });

  it("sends the stated figure for a freight load", () => {
    const payload = toCreatePayload(
      values({ weightBracket: "over1000", exactWeightKg: 12_000 }),
      true
    );

    expect(payload.weightKg).toBe(12_000);
  });

  it("sends a preset's dimensions", () => {
    const payload = toCreatePayload(values({ sizePreset: "l" }), true);

    expect(payload).toMatchObject(SIZE_PRESET_DIMENSIONS.l);
  });

  it("omits dimensions entirely when no size was chosen", () => {
    const payload = toCreatePayload(values(), true);

    expect(payload).not.toHaveProperty("lengthCm");
    expect(payload).not.toHaveProperty("widthCm");
    expect(payload).not.toHaveProperty("heightCm");
  });

  it("sends the typed dimensions in exact mode", () => {
    const payload = toCreatePayload(
      values({
        sizeMode: "exact",
        sizePreset: "xxl",
        lengthCm: 120,
        widthCm: 80,
        heightCm: 70,
      }),
      true
    );

    expect(payload).toMatchObject({
      lengthCm: 120,
      widthCm: 80,
      heightCm: 70,
    });
  });

  it("leaves the rest of the contract exactly as it was", () => {
    const payload = toCreatePayload(values(), false);

    expect(payload).toMatchObject({
      title: "Two-seater sofa",
      quantity: 1,
      // The form works in euros; the API is cents throughout.
      budgetCents: 25_000,
      publish: false,
    });
    expect(payload.pickupFrom).toBe("2026-09-01T08:00:00.000Z");
    // Stamped server-side: it decides who may award the job.
    expect(payload).not.toHaveProperty("origin");
    expect(payload).not.toHaveProperty("categoryId");
  });
});
