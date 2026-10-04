import { describe, expect, it } from "vitest";

import {
  ANY_PERIOD,
  ISO_WEEKDAYS,
  TIME_SLOTS,
  firstUsablePickup,
  forInput,
  resolveTimingWindows,
  togglePeriods,
  type EndpointTiming,
  type TimeSlot,
  type TimingState,
} from "../timing";

/**
 * The When step's answer turned into the window the schema validates
 * (request_availability_spec.md §4). Dates are built with local constructors,
 * so these hold in any timezone the suite runs in. 2030-01-02 is a Wednesday.
 */

const endpoint = (over: Partial<EndpointTiming> = {}): EndpointTiming => ({
  date: "2030-01-02",
  dateUntil: "2030-01-02",
  slot: "morning",
  hour: "09:00",
  periods: [...TIME_SLOTS],
  days: [...ISO_WEEKDAYS],
  ...over,
});

const flexible = (
  pickup: Partial<EndpointTiming>,
  dropoff: Partial<EndpointTiming> = { date: "2030-01-09", dateUntil: "2030-01-10" }
): TimingState => ({
  mode: "flexible",
  pickup: endpoint(pickup),
  dropoff: endpoint(dropoff),
});

const local = (day: number, hour: number, minute = 0, month = 1, year = 2030) =>
  forInput(new Date(year, month - 1, day, hour, minute).getTime());

/** The day before everything here: nothing is clamped. */
const EARLY = new Date(2029, 11, 30, 8, 0);
/** The afternoon the client tested, transposed. */
const AFTERNOON = new Date(2030, 0, 2, 13, 47);

describe("resolveTimingWindows — exact", () => {
  it("is one hour from the chosen time, with full sets", () => {
    const resolved = resolveTimingWindows(
      {
        mode: "exact",
        pickup: endpoint(),
        dropoff: endpoint({ date: "2030-01-03", hour: "14:30" }),
      },
      AFTERNOON
    );

    expect(resolved).toMatchObject({
      pickupFrom: "2030-01-02T09:00",
      pickupUntil: "2030-01-02T10:00",
      dropoffFrom: "2030-01-03T14:30",
      dropoffUntil: "2030-01-03T15:30",
      isFlexible: false,
      pickupDays: [...ISO_WEEKDAYS],
      pickupPeriods: [...TIME_SLOTS],
      pickupClampedFrom: null,
    });
  });

  it("ignores weekdays and times of day left over from flexible mode", () => {
    const resolved = resolveTimingWindows(
      { mode: "exact", pickup: endpoint({ days: [1], periods: ["evening"] }), dropoff: endpoint() },
      EARLY
    );

    expect(resolved.pickupDays).toEqual([...ISO_WEEKDAYS]);
    expect(resolved.pickupPeriods).toEqual([...TIME_SLOTS]);
  });

  it("is never clamped, even in the past — the publication check says so", () => {
    const resolved = resolveTimingWindows(
      { mode: "exact", pickup: endpoint({ hour: "09:00" }), dropoff: endpoint() },
      AFTERNOON
    );

    expect(resolved.pickupFrom).toBe("2030-01-02T09:00");
  });
});

describe("resolveTimingWindows — flexible", () => {
  it("reads « N'importe quand » as 06:00 to 22:00", () => {
    const resolved = resolveTimingWindows(
      flexible({ dateUntil: "2030-01-03" }),
      EARLY
    );

    expect(resolved.pickupFrom).toBe(local(2, 6));
    expect(resolved.pickupUntil).toBe(local(3, 22));
    expect(resolved.isFlexible).toBe(true);
  });

  it.each<[TimeSlot[], number, number]>([
    [["morning", "evening"], 6, 22],
    [["afternoon"], 12, 18],
    [["afternoon", "evening"], 12, 22],
    [["morning", "afternoon"], 6, 18],
  ])("starts at the earliest and ends at the latest of %j", (periods, start, end) => {
    const resolved = resolveTimingWindows(
      flexible({ dateUntil: "2030-01-03", periods }),
      EARLY
    );

    expect(resolved.pickupFrom).toBe(local(2, start));
    expect(resolved.pickupUntil).toBe(local(3, end));
    expect(resolved.pickupPeriods).toEqual(TIME_SLOTS.filter((p) => periods.includes(p)));
  });

  it("moves both ends to the ticked weekdays", () => {
    // Wednesday 2 → Sunday 6, only Thursday and Friday ticked.
    const resolved = resolveTimingWindows(
      flexible({ dateUntil: "2030-01-06", days: [5, 4] }),
      EARLY
    );

    expect(resolved.pickupFrom).toBe(local(3, 6));
    expect(resolved.pickupUntil).toBe(local(4, 22));
    expect(resolved.pickupDays).toEqual([4, 5]);
  });

  it("skips today's slots that have passed", () => {
    // The client's report: flexible, from today to tomorrow, mornings only,
    // pressed at 13:47. Today's morning is gone.
    const resolved = resolveTimingWindows(
      flexible({ dateUntil: "2030-01-03", periods: ["morning"] }),
      AFTERNOON
    );

    expect(resolved.pickupFrom).toBe(local(3, 6));
    expect(resolved.pickupUntil).toBe(local(3, 12));
    expect(resolved.pickupClampedFrom).toBe(local(3, 6));
  });

  it("matches the client's own dates", () => {
    // Du 02/10/2026 au 03/10/2026, Matin, at 13:47 on the 2nd.
    const resolved = resolveTimingWindows(
      {
        mode: "flexible",
        pickup: endpoint({ date: "2026-10-02", dateUntil: "2026-10-03", periods: ["morning"] }),
        dropoff: endpoint({ date: "2026-10-04", dateUntil: "2026-10-04" }),
      },
      new Date(2026, 9, 2, 13, 47)
    );

    expect(resolved.pickupFrom).toBe(local(3, 6, 0, 10, 2026));
    expect(resolved.dropoffFrom).toBe(local(4, 6, 0, 10, 2026));
  });

  it("starts a slot already under way half an hour past now plus the margin", () => {
    // 13:47 + 30 min of bidding + 5 min of margin = 14:22, rounded up.
    const resolved = resolveTimingWindows(
      flexible({ dateUntil: "2030-01-03" }),
      AFTERNOON
    );

    expect(resolved.pickupFrom).toBe(local(2, 14, 30));
    expect(resolved.pickupUntil).toBe(local(3, 22));
    expect(resolved.pickupClampedFrom).toBe(local(2, 14, 30));
  });

  it("does not clamp a range that starts later", () => {
    const resolved = resolveTimingWindows(
      flexible({ date: "2030-01-04", dateUntil: "2030-01-05" }),
      AFTERNOON
    );

    expect(resolved.pickupFrom).toBe(local(4, 6));
    expect(resolved.pickupClampedFrom).toBeNull();
  });

  it("never starts a delivery before the pickup", () => {
    // Pickup clamped to 14:30 today; delivery any time from today.
    const resolved = resolveTimingWindows(
      flexible({ dateUntil: "2030-01-03" }, { date: "2030-01-02", dateUntil: "2030-01-04" }),
      AFTERNOON
    );

    expect(resolved.dropoffFrom).toBe(resolved.pickupFrom);
    expect(resolved.dropoffUntil).toBe(local(4, 22));
  });

  it("moves a delivery to its next slot after the pickup", () => {
    // Pickup in the evening; delivery mornings only → the next morning.
    const resolved = resolveTimingWindows(
      flexible(
        { periods: ["evening"] },
        { date: "2030-01-02", dateUntil: "2030-01-03", periods: ["morning"] }
      ),
      EARLY
    );

    expect(resolved.pickupFrom).toBe(local(2, 18));
    expect(resolved.dropoffFrom).toBe(local(3, 6));
  });

  it("keeps the range as typed when no ticked weekday falls in it", () => {
    // Saturday 5 → Sunday 6 with only weekdays ticked: the schema says so.
    const resolved = resolveTimingWindows(
      flexible({ date: "2030-01-05", dateUntil: "2030-01-06", days: [1, 2, 3, 4, 5] }),
      EARLY
    );

    expect(resolved.pickupFrom).toBe(local(5, 6));
    expect(resolved.pickupUntil).toBe(local(6, 22));
    expect(resolved.pickupClampedFrom).toBeNull();
  });

  it("keeps the range as typed when nothing in it is still usable", () => {
    // Today only, at 23:00: the publication check reports it as passed.
    const resolved = resolveTimingWindows(flexible({}), new Date(2030, 0, 2, 23, 0));

    expect(resolved.pickupFrom).toBe(local(2, 6));
    expect(resolved.pickupUntil).toBe(local(2, 22));
    expect(resolved.pickupClampedFrom).toBeNull();
  });

  it("leaves the instants blank when a date is missing", () => {
    const resolved = resolveTimingWindows(flexible({ dateUntil: "" }), EARLY);

    expect(resolved.pickupFrom).toBe("");
    expect(resolved.pickupUntil).toBe("");
  });

  it("finds the ends of a long range without walking all of it", () => {
    const resolved = resolveTimingWindows(
      flexible({ dateUntil: "2031-01-02", days: [7] }, { date: "2031-01-10", dateUntil: "2031-01-12" }),
      EARLY
    );

    // The first Sunday after Wednesday 2 January 2030, and the last on or
    // before Thursday 2 January 2031.
    expect(resolved.pickupFrom).toBe(local(6, 6));
    expect(resolved.pickupUntil).toBe(local(29, 22, 0, 12, 2030));
  });
});

describe("firstUsablePickup", () => {
  it.each([
    [new Date(2030, 0, 2, 13, 47), local(2, 14, 30)],
    // Exactly on a half hour stays on it.
    [new Date(2030, 0, 2, 13, 55), local(2, 14, 30)],
    // Any second past it moves to the next.
    [new Date(2030, 0, 2, 13, 55, 30), local(2, 15, 0)],
  ])("from %s is %s", (now, expected) => {
    expect(forInput(firstUsablePickup(now).getTime())).toBe(expected);
  });
});

describe("togglePeriods", () => {
  const ALL = [...TIME_SLOTS];

  it.each<[string, TimeSlot[], string[], TimeSlot[]]>([
    ["narrows « N'importe quand » to the period pressed", ALL, [ANY_PERIOD, "morning"], ["morning"]],
    ["adds a second period", ["morning"], ["morning", "afternoon"], ["morning", "afternoon"]],
    ["lands back on « N'importe quand » at the third", ["morning", "afternoon"], ["morning", "afternoon", "evening"], ALL],
    ["widens back to all three from « N'importe quand »", ["morning"], ["morning", ANY_PERIOD], ALL],
    ["falls back to all three when the last period is unpressed", ["morning"], [], ALL],
    ["cannot unpress « N'importe quand » into nothing", ALL, [], ALL],
    ["removes a pressed period", ["morning", "evening"], ["evening"], ["evening"]],
  ])("%s", (_, current, pressed, expected) => {
    expect(togglePeriods(current, pressed)).toEqual(expected);
  });
});

// request_availability_spec.md §4 — what reaches a carrier
describe("resolveTimingWindows — the weekdays stored", () => {
  // 2030-01-07 is a Monday.
  it("keeps only the ticked days the range can hold", () => {
    // Monday → Tuesday, Tuesday unticked; Wednesday–Sunday are greyed out but
    // still ticked on screen.
    const resolved = resolveTimingWindows(
      flexible({ date: "2030-01-07", dateUntil: "2030-01-08", days: [1, 3, 4, 5, 6, 7] }),
      EARLY
    );

    expect(resolved.pickupDays).toEqual([1]);
  });

  it("stores no restriction when every day in the range is ticked", () => {
    const resolved = resolveTimingWindows(
      flexible({ date: "2030-01-07", dateUntil: "2030-01-08", days: [1, 2] }),
      EARLY
    );

    expect(resolved.pickupDays).toEqual([...ISO_WEEKDAYS]);
  });

  it("keeps a week-long choice as it is", () => {
    const resolved = resolveTimingWindows(
      flexible({ date: "2030-01-07", dateUntil: "2030-01-20", days: [1, 2, 4, 5, 6, 7] }),
      EARLY
    );

    expect(resolved.pickupDays).toEqual([1, 2, 4, 5, 6, 7]);
  });

  it("keeps the ticks as typed when none falls in the range, for the schema to say", () => {
    const resolved = resolveTimingWindows(
      flexible({ date: "2030-01-12", dateUntil: "2030-01-13", days: [1, 2, 3, 4, 5] }),
      EARLY
    );

    expect(resolved.pickupDays).toEqual([1, 2, 3, 4, 5]);
  });
});
