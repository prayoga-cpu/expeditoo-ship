/**
 * "Which days, and at what time of day."
 *
 * A job open 26 August → 9 September tells a driver almost nothing about when
 * it actually happens, and a driver free only on 2 September has no way to say
 * so. This turns a set of chosen days and times of day into concrete instants
 * the board can test a pickup window against.
 *
 * Pure and dependency-free. See docs/specs/board_route_search_spec.md §5.
 */

export const TIME_SLOTS = ["morning", "afternoon", "evening"] as const;

export type TimeSlot = (typeof TIME_SLOTS)[number];

/** Local hours, half-open at the end. */
export const SLOT_HOURS: Record<TimeSlot, { start: number; end: number }> = {
  morning: { start: 6, end: 12 },
  afternoon: { start: 12, end: 18 },
  evening: { start: 18, end: 22 },
};

/**
 * Six weeks of planning is already more than a driver holds in their head, and
 * the cap is what bounds the `OR` the DAL builds.
 */
export const MAX_AVAILABILITY_DAYS = 31;

export interface Interval {
  start: Date;
  end: Date;
}

/** A day the driver picked, as `YYYY-MM-DD` — no timezone, by design. */
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const isAvailabilityDay = (value: string) => DAY_PATTERN.test(value);

/**
 * A `Date` as the local calendar day it falls on, and back.
 *
 * `toISOString().slice(0, 10)` is the trap this exists to avoid: it converts to
 * UTC first, so a French evening becomes the following day. Everything that
 * writes one of these strings — the board filter, an offer's proposed slots —
 * means the day the driver is looking at.
 */
export const toDayString = (date: Date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");

export const parseDayString = (day: string) => {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date);
};

/** Midnight today: a job can still be collected later on the current day. */
export const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

/**
 * The chosen days and slots as absolute instants.
 *
 * `tzOffsetMinutes` is the driver's `Date.prototype.getTimezoneOffset()`:
 * minutes to add to local time to reach UTC. Production runs `TZ=UTC`, so
 * without it a French driver's 06:00 would be filtered as 08:00.
 *
 * Adjacent slots on the same day are merged, so morning + afternoon is one
 * 06:00–18:00 interval rather than two, and all three collapse to one. Days
 * chosen with no slot at all mean the whole of those days.
 */
export function availabilityIntervals(
  days: readonly string[],
  slots: readonly TimeSlot[],
  tzOffsetMinutes: number
): Interval[] {
  if (days.length === 0) return [];

  const ranges = slots.length > 0 ? mergeSlots(slots) : [{ start: 0, end: 24 }];

  return days.flatMap((day) =>
    ranges.map((range) => ({
      start: instantAt(day, range.start, tzOffsetMinutes),
      end: instantAt(day, range.end, tzOffsetMinutes),
    }))
  );
}

/**
 * One `(day, time of day)` pair as an absolute interval.
 *
 * The offer side proposes slots one at a time rather than as a grid, so it
 * needs the hour table without the merging `availabilityIntervals` does. Both
 * read `SLOT_HOURS`, which is the point — the hours are written once.
 * See `src/lib/offer-slots.ts`.
 */
export function slotInterval(
  day: string,
  slot: TimeSlot,
  tzOffsetMinutes: number
): Interval {
  const hours = SLOT_HOURS[slot];
  return {
    start: instantAt(day, hours.start, tzOffsetMinutes),
    end: instantAt(day, hours.end, tzOffsetMinutes),
  };
}

interface HourRange {
  start: number;
  end: number;
}

/** Chosen slots as the fewest contiguous hour ranges that cover them. */
function mergeSlots(slots: readonly TimeSlot[]): HourRange[] {
  const chosen = TIME_SLOTS.filter((slot) => slots.includes(slot)).map(
    (slot) => SLOT_HOURS[slot]
  );

  const merged: HourRange[] = [];
  for (const range of chosen) {
    const previous = merged[merged.length - 1];
    if (previous && previous.end === range.start) {
      previous.end = range.end;
    } else {
      merged.push({ ...range });
    }
  }

  return merged;
}

function instantAt(day: string, hour: number, tzOffsetMinutes: number): Date {
  const [year, month, date] = day.split("-").map(Number);
  // `hour` reaches 24 for a whole-day range; Date.UTC rolls it into the next
  // day, which is exactly the boundary wanted.
  return new Date(
    Date.UTC(year, month - 1, date, hour) + tzOffsetMinutes * 60_000
  );
}
