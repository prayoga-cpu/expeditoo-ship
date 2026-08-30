import { describe, expect, it } from "vitest";

import {
  DELIVERY_DEADLINE_HOUR,
  MAX_OFFER_SLOTS,
  MAX_OFFER_SLOT_DAYS,
  deliveryInstant,
  hasDuplicateSlots,
  overlapsWindow,
  addDays,
  isOfferSlotDay,
  offerablePeriods,
  resolveOfferSlots,
  slotDayCount,
  slotsForDays,
} from "../offer-slots";

/** Paris in summer: UTC+2, so `getTimezoneOffset()` reports -120. */
const PARIS_SUMMER = -120;

const iso = (date: Date) => date.toISOString();

describe("resolveOfferSlots", () => {
  it("places a slot at the driver's local hours, not the server's", () => {
    const [slot] = resolveOfferSlots(
      [{ day: "2026-08-25", slot: "morning" }],
      0,
      PARIS_SUMMER
    );

    // 06:00-12:00 in Paris is 04:00-10:00 UTC. Production runs TZ=UTC, so
    // without the offset this driver's morning would start at 08:00 for them.
    expect(iso(slot.startsAt)).toBe("2026-08-25T04:00:00.000Z");
    expect(iso(slot.endsAt)).toBe("2026-08-25T10:00:00.000Z");
  });

  it("resolves each period to its own hours", () => {
    const slots = resolveOfferSlots(
      [
        { day: "2026-08-25", slot: "afternoon" },
        { day: "2026-08-25", slot: "evening" },
      ],
      0,
      0
    );

    expect(slots.map((s) => [s.startsAt.getUTCHours(), s.endsAt.getUTCHours()]))
      .toEqual([
        [12, 18],
        [18, 22],
      ]);
  });

  it("returns them earliest first, whatever order they were entered", () => {
    const slots = resolveOfferSlots(
      [
        { day: "2026-09-02", slot: "morning" },
        { day: "2026-08-25", slot: "evening" },
        { day: "2026-08-25", slot: "morning" },
      ],
      0,
      PARIS_SUMMER
    );

    expect(slots.map((s) => `${s.day} ${s.slot}`)).toEqual([
      "2026-08-25 morning",
      "2026-08-25 evening",
      "2026-09-02 morning",
    ]);
  });

  it("promises delivery by the end of the day the lead names", () => {
    const [sameDay] = resolveOfferSlots(
      [{ day: "2026-08-25", slot: "morning" }],
      0,
      PARIS_SUMMER
    );
    const [nextDay] = resolveOfferSlots(
      [{ day: "2026-08-25", slot: "morning" }],
      1,
      PARIS_SUMMER
    );

    // 22:00 Paris, not the 12:00 the slot itself closes at: nobody collecting
    // at 11:00 has delivered by noon.
    expect(iso(sameDay.deliveryAt)).toBe("2026-08-25T20:00:00.000Z");
    expect(iso(nextDay.deliveryAt)).toBe("2026-08-26T20:00:00.000Z");
  });

  it("always promises delivery after the collection starts", () => {
    const slots = resolveOfferSlots(
      [
        { day: "2026-08-25", slot: "morning" },
        { day: "2026-08-25", slot: "afternoon" },
        { day: "2026-08-25", slot: "evening" },
      ],
      0,
      PARIS_SUMMER
    );

    // This is what makes a delivery-before-pickup offer unrepresentable rather
    // than merely refused: no slot begins after the deadline hour.
    expect(slots.every((s) => s.deliveryAt > s.startsAt)).toBe(true);
    expect(DELIVERY_DEADLINE_HOUR).toBe(22);
  });

  it("rolls the delivery over a month boundary", () => {
    expect(iso(deliveryInstant("2026-08-31", 2, 0))).toBe(
      "2026-09-02T22:00:00.000Z"
    );
  });

  it("returns nothing for an empty proposal", () => {
    expect(resolveOfferSlots([], 0, PARIS_SUMMER)).toEqual([]);
  });
});

describe("overlapsWindow", () => {
  const window = {
    from: new Date("2026-08-25T09:00:00Z"),
    until: new Date("2026-08-25T11:00:00Z"),
  };

  const slot = (day: string, period: "morning" | "afternoon" | "evening") =>
    resolveOfferSlots([{ day, slot: period }], 0, 0)[0];

  it("accepts a slot that merely overlaps, rather than demanding containment", () => {
    // 06:00-12:00 is wider than the window on both sides. Demanding
    // containment would mean no driver could offer the first morning of a job.
    expect(overlapsWindow(slot("2026-08-25", "morning"), window)).toBe(true);
  });

  it("rejects a slot on the same day that misses the window", () => {
    expect(overlapsWindow(slot("2026-08-25", "evening"), window)).toBe(false);
  });

  it("rejects a slot on another day", () => {
    expect(overlapsWindow(slot("2026-08-27", "morning"), window)).toBe(false);
  });

  it("treats a touching boundary as no overlap", () => {
    const touching = {
      from: new Date("2026-08-25T12:00:00Z"),
      until: new Date("2026-08-25T18:00:00Z"),
    };
    expect(overlapsWindow(slot("2026-08-25", "morning"), touching)).toBe(false);
  });
});

describe("proposal shape", () => {
  it("counts distinct days, not slots", () => {
    expect(
      slotDayCount([
        { day: "2026-08-25", slot: "morning" },
        { day: "2026-08-25", slot: "evening" },
        { day: "2026-08-27", slot: "morning" },
      ])
    ).toBe(2);
  });

  it("spots a repeated day and period", () => {
    expect(
      hasDuplicateSlots([
        { day: "2026-08-25", slot: "morning" },
        { day: "2026-08-25", slot: "morning" },
      ])
    ).toBe(true);
  });

  it("does not mistake two periods on one day for a duplicate", () => {
    expect(
      hasDuplicateSlots([
        { day: "2026-08-25", slot: "morning" },
        { day: "2026-08-25", slot: "evening" },
      ])
    ).toBe(false);
  });

  it("caps the proposal at every period on every allowed day", () => {
    expect(MAX_OFFER_SLOTS).toBe(MAX_OFFER_SLOT_DAYS * 3);
  });
});

describe("slotsForDays", () => {
  it("gives a newly chosen day every period — 'en journée'", () => {
    expect(slotsForDays([], ["2026-08-25"])).toEqual([
      { day: "2026-08-25", slot: "morning" },
      { day: "2026-08-25", slot: "afternoon" },
      { day: "2026-08-25", slot: "evening" },
    ]);
  });

  it("keeps the periods a driver already narrowed a day to", () => {
    const existing = [{ day: "2026-08-25", slot: "evening" as const }];

    expect(slotsForDays(existing, ["2026-08-25", "2026-08-27"])).toEqual([
      { day: "2026-08-25", slot: "evening" },
      { day: "2026-08-27", slot: "morning" },
      { day: "2026-08-27", slot: "afternoon" },
      { day: "2026-08-27", slot: "evening" },
    ]);
  });

  it("drops a day the driver removed, and the periods with it", () => {
    const existing = [
      { day: "2026-08-25", slot: "morning" as const },
      { day: "2026-08-27", slot: "morning" as const },
    ];

    expect(slotsForDays(existing, ["2026-08-27"])).toEqual([
      { day: "2026-08-27", slot: "morning" },
    ]);
  });

  it("returns days in order and periods in clock order", () => {
    const existing = [
      { day: "2026-08-27", slot: "evening" as const },
      { day: "2026-08-27", slot: "morning" as const },
    ];

    expect(slotsForDays(existing, ["2026-08-27", "2026-08-25"])).toEqual([
      { day: "2026-08-25", slot: "morning" },
      { day: "2026-08-25", slot: "afternoon" },
      { day: "2026-08-25", slot: "evening" },
      { day: "2026-08-27", slot: "morning" },
      { day: "2026-08-27", slot: "evening" },
    ]);
  });
});

describe("isOfferSlotDay", () => {
  it("accepts a real day", () => {
    expect(isOfferSlotDay("2026-08-25")).toBe(true);
  });

  it("rejects a day that is merely well shaped", () => {
    // Date.UTC rolls this into 3 March, so the row's words would name a
    // different day from its own instants.
    expect(isOfferSlotDay("2026-02-31")).toBe(false);
    expect(isOfferSlotDay("2026-13-01")).toBe(false);
    expect(isOfferSlotDay("2026-00-10")).toBe(false);
  });

  it("keeps 29 February in a leap year", () => {
    expect(isOfferSlotDay("2028-02-29")).toBe(true);
    expect(isOfferSlotDay("2026-02-29")).toBe(false);
  });

  it("rejects anything that is not YYYY-MM-DD", () => {
    expect(isOfferSlotDay("25/08/2026")).toBe(false);
  });
});

describe("addDays", () => {
  it("stays a day string across a month boundary", () => {
    expect(addDays("2026-08-31", 2)).toBe("2026-09-02");
  });

  it("stays a day string across a year boundary", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("returns the same day for a zero lead", () => {
    expect(addDays("2026-08-25", 0)).toBe("2026-08-25");
  });
});

describe("offerablePeriods", () => {
  const NOW = new Date("2026-08-01T00:00:00Z");
  const whole = (day: string) => ({
    from: new Date(`${day}T00:00:00Z`),
    until: new Date(`${day}T23:59:59Z`),
    isFlexible: false,
  });

  it("offers every period of a day the window covers", () => {
    expect(offerablePeriods("2026-08-25", whole("2026-08-25"), NOW, 0)).toEqual([
      "morning",
      "afternoon",
      "evening",
    ]);
  });

  // The refusal this exists to prevent: the service rejects an offer WHOLE, so
  // defaulting a boundary day to "en journée" would cost the driver the bid.
  it("offers only the periods a partial window can take", () => {
    const window = {
      from: new Date("2026-08-25T09:00:00Z"),
      until: new Date("2026-08-25T11:00:00Z"),
      isFlexible: false,
    };

    expect(offerablePeriods("2026-08-25", window, NOW, 0)).toEqual(["morning"]);
  });

  it("drops a period that has already ended", () => {
    const midday = new Date("2026-08-25T13:00:00Z");

    expect(offerablePeriods("2026-08-25", whole("2026-08-25"), midday, 0)).toEqual(
      ["afternoon", "evening"]
    );
  });

  it("keeps a period that has started but not ended", () => {
    const midMorning = new Date("2026-08-25T10:00:00Z");

    expect(
      offerablePeriods("2026-08-25", whole("2026-08-25"), midMorning, 0)
    ).toContain("morning");
  });

  it("ignores the window entirely when the job is flexible", () => {
    const elsewhere = {
      from: new Date("2027-01-01T00:00:00Z"),
      until: new Date("2027-01-02T00:00:00Z"),
      isFlexible: true,
    };

    expect(offerablePeriods("2026-08-25", elsewhere, NOW, 0)).toHaveLength(3);
  });

  it("offers nothing on a day wholly in the past", () => {
    expect(
      offerablePeriods("2026-07-01", whole("2026-07-01"), NOW, 0)
    ).toEqual([]);
  });

  it("defaults a newly added day to only what is offerable", () => {
    const window = {
      from: new Date("2026-08-25T09:00:00Z"),
      until: new Date("2026-08-25T11:00:00Z"),
      isFlexible: false,
    };

    expect(
      slotsForDays([], ["2026-08-25"], (day) =>
        offerablePeriods(day, window, NOW, 0)
      )
    ).toEqual([{ day: "2026-08-25", slot: "morning" }]);
  });
});
