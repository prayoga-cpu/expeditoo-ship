import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOfferSchema } from "@/server/dto/offers.dto";

/**
 * Frozen mid-morning UTC so "this slot has not ended yet" is a fact rather
 * than a property of the hour the suite happens to run at.
 */
const NOW = new Date("2026-08-25T10:00:00Z");

const TODAY = "2026-08-25";
const TOMORROW = "2026-08-26";

const input = (over: Record<string, unknown> = {}) => ({
  vehicleId: "veh-1",
  priceCents: 18_000,
  slots: [{ day: TOMORROW, slot: "morning" }],
  tzOffset: 0,
  ...over,
});

/** The refusal codes a parse produced, in issue order. */
const codesFrom = (value: Record<string, unknown>) => {
  const result = createOfferSchema.safeParse(value);
  return result.success ? [] : result.error.issues.map((i) => i.message);
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createOfferSchema", () => {
  it("accepts a single proposed slot and defaults the delivery lead", () => {
    const parsed = createOfferSchema.parse(input());

    expect(parsed.slots).toEqual([{ day: TOMORROW, slot: "morning" }]);
    expect(parsed.deliveryLeadDays).toBe(0);
  });

  it("requires at least one slot", () => {
    expect(codesFrom(input({ slots: [] }))).toContain("SLOTS_REQUIRED");
  });

  it("refuses more than four distinct days", () => {
    const slots = ["2026-08-26", "2026-08-27", "2026-08-28", "2026-08-29", "2026-08-30"].map(
      (day) => ({ day, slot: "morning" })
    );

    expect(codesFrom(input({ slots }))).toContain("TOO_MANY_SLOT_DAYS");
  });

  it("allows every period on all four days", () => {
    const slots = ["2026-08-26", "2026-08-27", "2026-08-28", "2026-08-29"].flatMap(
      (day) =>
        ["morning", "afternoon", "evening"].map((slot) => ({ day, slot }))
    );

    expect(createOfferSchema.safeParse(input({ slots })).success).toBe(true);
  });

  it("refuses the same day and period twice", () => {
    const slots = [
      { day: TOMORROW, slot: "morning" },
      { day: TOMORROW, slot: "morning" },
    ];

    expect(codesFrom(input({ slots }))).toContain("SLOT_DUPLICATE");
  });

  it("refuses a day that is not YYYY-MM-DD", () => {
    expect(codesFrom(input({ slots: [{ day: "26/08/2026", slot: "morning" }] })))
      .toContain("SLOT_DAY_INVALID");
  });

  // The slot's end, not its start: a driver bidding at 10:00 can still offer
  // this morning, and that is the honest reading of the offer.
  it("accepts a slot that has started but not ended", () => {
    const parsed = createOfferSchema.safeParse(
      input({ slots: [{ day: TODAY, slot: "morning" }] })
    );

    expect(parsed.success).toBe(true);
  });

  it("refuses a slot that has already ended", () => {
    expect(codesFrom(input({ slots: [{ day: "2026-08-24", slot: "evening" }] })))
      .toContain("SLOT_IN_PAST");
  });

  it("refuses a delivery lead beyond a week", () => {
    expect(codesFrom(input({ deliveryLeadDays: 8 }))).toContain(
      "DELIVERY_LEAD_OUT_OF_RANGE"
    );
  });

  it("no longer accepts a caller-named pickup datetime", () => {
    const parsed = createOfferSchema.parse(
      input({ estimatedPickup: "2026-08-26T09:00:00Z" })
    );

    expect(parsed).not.toHaveProperty("estimatedPickup");
  });
});
