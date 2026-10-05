import { describe, expect, it } from "vitest";

import { SIZE_PRESET_DIMENSIONS } from "../cargo";
import { jobFormSchema, type JobFormOutput } from "../schemas";
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
  contactPhone: "0612345678",
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
    pickupDays: [1, 2, 3, 4, 5, 6, 7],
    pickupPeriods: ["morning", "afternoon", "evening"],
    dropoffDays: [1, 2, 3, 4, 5, 6, 7],
    dropoffPeriods: ["morning", "afternoon", "evening"],
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

  it("sends the notSure bracket's ceiling as the weight", () => {
    expect(
      toCreatePayload(values({ weightBracket: "notSure" }), true).weightKg
    ).toBe(500);
  });

  it("folds a fragile note into the description", () => {
    const payload = toCreatePayload(
      values({ isFragile: true, fragileNote: "Glass top, keep upright" }),
      true
    );

    expect(payload.description).toBe(
      "A sofa and a coffee table, ground floor at both ends.\n\n" +
        "Fragile: Glass top, keep upright"
    );
  });

  it("ignores a fragile note left over from a toggle switched back off", () => {
    const payload = toCreatePayload(
      values({ isFragile: false, fragileNote: "Glass top" }),
      true
    );

    expect(payload.description).toBe(
      "A sofa and a coffee table, ground floor at both ends."
    );
  });

  it("leaves the description alone when fragile but no note was typed", () => {
    const payload = toCreatePayload(values({ isFragile: true }), true);

    expect(payload.description).toBe(
      "A sofa and a coffee table, ground floor at both ends."
    );
  });

  it("sends a place given as a link as its coordinates, not the mode", () => {
    const payload = toCreatePayload(
      values({
        pickup: {
          ...endpoint,
          saveAddress: false,
          locationEntry: "link",
          note: "Gate",
        },
      }),
      true
    );

    expect(payload.pickup).not.toHaveProperty("locationEntry");
    expect(payload.pickup).toMatchObject({ lat: 45.75, lng: 4.85, note: "Gate" });
  });

  it("sends the packaging services beside the state they sit next to", () => {
    const payload = toCreatePayload(
      values({
        packagingLevel: "protected",
        needsProtection: false,
        needsPackaging: true,
      }),
      true
    );

    expect(payload).toMatchObject({
      packagingLevel: "protected",
      needsProtection: false,
      needsPackaging: true,
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

// numeric_input_spec.md §7: the text the Budget box holds, through the schema,
// to the cents the API is sent — on the digits, never a float short.
describe("toCreatePayload — a budget typed as text", () => {
  const typed = (budgetEuros: string) =>
    jobFormSchema.parse({
      title: "Two-seater sofa",
      description: "A sofa and a coffee table, ground floor at both ends.",
      weightBracket: "upTo100",
      pickup: endpoint,
      dropoff: {
        ...endpoint,
        lat: 43.3,
        lng: 5.37,
        city: "Marseille",
        postalCode: "13001",
      },
      pickupFrom: "2030-01-07T08:00",
      pickupUntil: "2030-01-07T16:00",
      dropoffFrom: "2030-01-08T08:00",
      dropoffUntil: "2030-01-08T16:00",
      pickupDays: [1, 2, 3, 4, 5, 6, 7],
      pickupPeriods: ["morning", "afternoon", "evening"],
      dropoffDays: [1, 2, 3, 4, 5, 6, 7],
      dropoffPeriods: ["morning", "afternoon", "evening"],
      budgetEuros,
    });

  it.each([
    ["40,5", 4050],
    ["40,05", 4005],
    ["40.05", 4005],
    ["89,90", 8990],
    ["040", 4000],
    ["100000", 10_000_000],
  ])("posts « %s » € as %d cents", (text, cents) => {
    expect(toCreatePayload(typed(text), true).budgetCents).toBe(cents);
  });
});

// request_availability_spec.md §3, publication_timing_spec.md §2
describe("toCreatePayload — when", () => {
  it("sends the weekdays and times of day of each end", () => {
    const payload = toCreatePayload(
      values({
        isFlexible: true,
        pickupDays: [1, 2, 3, 4, 5],
        pickupPeriods: ["morning", "afternoon"],
        dropoffDays: [6],
        dropoffPeriods: ["evening"],
      }),
      true
    );

    expect(payload).toMatchObject({
      isFlexible: true,
      pickupDays: [1, 2, 3, 4, 5],
      pickupPeriods: ["morning", "afternoon"],
      dropoffDays: [6],
      dropoffPeriods: ["evening"],
    });
  });

  it("sends a schedule with a publication", () => {
    const scheduledPublishAt = new Date("2026-08-31T08:00:00Z");
    const payload = toCreatePayload(
      values({ publishMode: "schedule", scheduledPublishAt }),
      true
    );

    expect(payload.scheduledPublishAt).toBe("2026-08-31T08:00:00.000Z");
  });

  it("keeps no schedule on a draft", () => {
    const payload = toCreatePayload(
      values({
        publishMode: "schedule",
        scheduledPublishAt: new Date("2026-08-31T08:00:00Z"),
      }),
      false
    );

    expect(payload).not.toHaveProperty("scheduledPublishAt");
  });
});
