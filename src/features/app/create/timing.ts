import {
  ISO_WEEKDAYS,
  TIME_SLOTS,
  SLOT_HOURS,
  isAvailabilityDay,
  isoWeekday,
  mergeSlots,
  parseDayString,
  toDayString,
  weekdaysBetween,
  type IsoWeekday,
  type TimeSlot,
} from "@/lib/availability-window";
import { earliestPickupFor } from "@/lib/listing-window";

/**
 * How a requester states when a job happens, translated into the four
 * `pickupFrom` / `pickupUntil` / `dropoffFrom` / `dropoffUntil` instants and
 * the `isFlexible` flag `jobFormSchema` and `createListingSchema` validate —
 * see `src/features/app/create/schemas.ts` — plus, for a flexible request, the
 * weekdays and times of day someone is there at each end
 * (docs/specs/request_availability_spec.md).
 *
 * `exact` names one instant per endpoint — a date, a time of day, and an hour
 * within it — and turns it into a one-hour arrival window, because the schema
 * requires `pickupFrom < pickupUntil` and a person does not think in windows
 * when they mean "9 o'clock". `flexible` names a date range, the weekdays and
 * the times of day within it; `isFlexible: true` is what already tells
 * `offers.service.ts` a carrier may propose outside it altogether
 * (see `offersService.submitOffer`), so all of it is a preference, not a hard
 * boundary.
 */

export const TIMING_MODES = ["exact", "flexible"] as const;
export type TimingMode = (typeof TIMING_MODES)[number];

/** How wide the arrival window is around an exact time. */
export const EXACT_WINDOW_HOURS = 1;

/**
 * Room for the request to reach the server after the form decided: the form
 * re-derives the window at submit, so this only has to cover the round trip
 * and a modest clock difference.
 */
const SUBMIT_MARGIN_MS = 5 * 60 * 1000;

/**
 * Weekdays recur within seven days; one more covers the day already partly
 * gone. Enough to find the first or last allowed day of any range without
 * walking all of it.
 */
const DAY_SCAN_LIMIT = ISO_WEEKDAYS.length + 1;

export interface EndpointTiming {
  /** Exact mode: the day. Flexible mode: the range's start day. */
  date: string;
  /** Flexible mode only: the range's end day. */
  dateUntil: string;
  /** Exact mode only: the time of day `hour` sits in. */
  slot: TimeSlot;
  /** Exact mode only: "HH:mm" within `slot`'s hours. */
  hour: string;
  /** Flexible mode only: the times of day someone is there. All three = any time. */
  periods: TimeSlot[];
  /** Flexible mode only: the weekdays someone is there. All seven = every day. */
  days: IsoWeekday[];
}

export interface TimingState {
  mode: TimingMode;
  pickup: EndpointTiming;
  dropoff: EndpointTiming;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DDTHH:mm" from a timestamp, in local time — what the schema wants. */
export function forInput(at: number): string {
  const d = new Date(at);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

function addHours(dateTimeLocal: string, hours: number): string {
  const d = new Date(dateTimeLocal);
  d.setHours(d.getHours() + hours);
  return forInput(d.getTime());
}

/** The first half-hour of a time-of-day, as the dropdown's default choice. */
export function defaultHourForSlot(slot: TimeSlot): string {
  return `${pad(SLOT_HOURS[slot].start)}:00`;
}

/** Half-hour choices inside a time-of-day, half-open at the end like `SLOT_HOURS`. */
export function hourOptions(slot: TimeSlot): string[] {
  const { start, end } = SLOT_HOURS[slot];
  const options: string[] = [];
  for (let h = start; h < end; h++) {
    options.push(`${pad(h)}:00`, `${pad(h)}:30`);
  }
  return options;
}

/**
 * The earliest pickup start the form can promise the server will accept for a
 * request published at `publishAt`: thirty minutes of bidding, the submit
 * margin, then up to the next half hour so the time reads like one a person
 * would pick (publication_timing_spec.md §3.2).
 */
export function firstUsablePickup(publishAt: Date): Date {
  const at = earliestPickupFor(publishAt).getTime() + SUBMIT_MARGIN_MS;
  const d = new Date(Math.ceil(at / 60_000) * 60_000);
  d.setMinutes(d.getMinutes() + ((30 - (d.getMinutes() % 30)) % 30));
  return d;
}

/** Times of day in their canonical order; none at all reads as any time. */
export function canonicalPeriods(periods: readonly TimeSlot[]): TimeSlot[] {
  const chosen = TIME_SLOTS.filter((period) => periods.includes(period));
  return chosen.length > 0 ? chosen : [...TIME_SLOTS];
}

/** The toggle that stands for all three times of day. */
export const ANY_PERIOD = "any";

/**
 * The times of day after a press on the « N'importe quand · Matin · Après-midi ·
 * Soir » toggles, given what they hold now and the values the toggle group
 * reports pressed (request_availability_spec.md §5). « N'importe quand » *is*
 * all three: pressing it from a narrower choice widens back to all three;
 * pressing a period from it narrows to that period; unpressing the last period
 * lands back on it.
 */
export function togglePeriods(
  current: readonly TimeSlot[],
  pressed: readonly string[]
): TimeSlot[] {
  const wasAny = current.length === TIME_SLOTS.length;
  if (!wasAny && pressed.includes(ANY_PERIOD)) return [...TIME_SLOTS];
  return canonicalPeriods(TIME_SLOTS.filter((period) => pressed.includes(period)));
}

const sortedDays = (days: readonly IsoWeekday[]): IsoWeekday[] =>
  ISO_WEEKDAYS.filter((day) => days.includes(day));

/**
 * The weekdays a flexible end stores: the ticked days its range can actually
 * hold. A day the range does not reach is disabled on screen and keeps its
 * tick only so that widening the range brings it back — it says nothing about
 * when anyone is there, so it must never reach a carrier as "suits the client".
 * Every reachable day ticked is no restriction at all: the full set, and no
 * line under the window. None ticked is kept as typed for the schema's
 * `noAllowedDay` to report (request_availability_spec.md §4).
 */
function storedDays(endpoint: EndpointTiming): IsoWeekday[] {
  const reachable = weekdaysBetween(endpoint.date, endpoint.dateUntil);
  const chosen = reachable.filter((day) => endpoint.days.includes(day));
  if (chosen.length === 0) return sortedDays(endpoint.days);
  return chosen.length === reachable.length ? [...ISO_WEEKDAYS] : chosen;
}

interface Interval {
  start: Date;
  end: Date;
}

function localAt(day: string, hour: number): Date {
  const d = parseDayString(day);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function addDays(day: string, n: number): string {
  const d = parseDayString(day);
  d.setDate(d.getDate() + n);
  return toDayString(d);
}

/** One day's chosen times of day, merged where they touch (06–18, not 06–12 + 12–18). */
function dayIntervals(day: string, periods: readonly TimeSlot[]): Interval[] {
  return mergeSlots(periods).map((range) => ({
    start: localAt(day, range.start),
    end: localAt(day, range.end),
  }));
}

const isAllowedDay = (endpoint: EndpointTiming, day: string) =>
  endpoint.days.includes(isoWeekday(parseDayString(day)));

/**
 * The first allowed (day, time of day) interval that ends after `notBefore`,
 * scanning forward from the later of the range's start and `notBefore`'s own
 * day. `null` when the range holds none.
 */
function firstInterval(
  endpoint: EndpointTiming,
  notBefore: Date | null
): Interval | null {
  let day = endpoint.date;
  if (notBefore && toDayString(notBefore) > day) day = toDayString(notBefore);

  for (let i = 0; i < DAY_SCAN_LIMIT && day <= endpoint.dateUntil; i++) {
    if (isAllowedDay(endpoint, day)) {
      const match = dayIntervals(day, endpoint.periods).find(
        (interval) => !notBefore || interval.end > notBefore
      );
      if (match) return match;
    }
    day = addDays(day, 1);
  }
  return null;
}

/** The last allowed interval, scanning back from the range's end. */
function lastInterval(endpoint: EndpointTiming): Interval | null {
  let day = endpoint.dateUntil;
  for (let i = 0; i < DAY_SCAN_LIMIT && day >= endpoint.date; i++) {
    if (isAllowedDay(endpoint, day)) {
      const intervals = dayIntervals(day, endpoint.periods);
      return intervals[intervals.length - 1];
    }
    day = addDays(day, -1);
  }
  return null;
}

interface ResolvedEndpoint {
  from: string;
  until: string;
  /** The start moved past slots that are already gone or too close. */
  clamped: boolean;
}

/**
 * A flexible end as one window: from the first allowed slot still usable after
 * `notBefore` to the end of the last allowed slot (request_availability_spec.md
 * §4). When nothing usable is left, or no allowed weekday falls in the range,
 * the window is kept as typed so the schema or the publication check can say
 * so, rather than one being invented.
 */
function resolveFlexible(
  endpoint: EndpointTiming,
  notBefore: Date | null
): ResolvedEndpoint {
  if (!isAvailabilityDay(endpoint.date) || !isAvailabilityDay(endpoint.dateUntil)) {
    return { from: "", until: "", clamped: false };
  }

  const scoped = { ...endpoint, periods: canonicalPeriods(endpoint.periods) };
  const first = firstInterval(scoped, null);
  const last = lastInterval(scoped);

  if (!first || !last) {
    const periods = scoped.periods;
    return {
      from: forInput(localAt(endpoint.date, SLOT_HOURS[periods[0]].start).getTime()),
      until: forInput(
        localAt(endpoint.dateUntil, SLOT_HOURS[periods[periods.length - 1]].end).getTime()
      ),
      clamped: false,
    };
  }

  const usable = notBefore ? firstInterval(scoped, notBefore) : first;
  if (!usable) {
    return {
      from: forInput(first.start.getTime()),
      until: forInput(last.end.getTime()),
      clamped: false,
    };
  }

  const start = notBefore && usable.start < notBefore ? notBefore : usable.start;
  return {
    from: forInput(start.getTime()),
    until: forInput(last.end.getTime()),
    clamped: start > first.start,
  };
}

function resolveExact(endpoint: EndpointTiming): { from: string; until: string } {
  if (!isAvailabilityDay(endpoint.date)) return { from: "", until: "" };
  const from = `${endpoint.date}T${endpoint.hour}`;
  return { from, until: addHours(from, EXACT_WINDOW_HOURS) };
}

/**
 * The four dates, the flag and the four availability sets the form's fields
 * hold, plus — for the hint under « Enlèvement » — the derived start when it
 * is later than the range's own first slot.
 *
 * `now` matters only in flexible mode: a range that starts today starts at the
 * first slot still usable, never at one already gone. The form calls this on
 * every change and again at submit, so a page left open does not post a start
 * that has since become too soon.
 */
export function resolveTimingWindows(timing: TimingState, now = new Date()) {
  if (timing.mode === "exact") {
    const pickup = resolveExact(timing.pickup);
    const dropoff = resolveExact(timing.dropoff);
    return {
      pickupFrom: pickup.from,
      pickupUntil: pickup.until,
      dropoffFrom: dropoff.from,
      dropoffUntil: dropoff.until,
      isFlexible: false,
      pickupDays: [...ISO_WEEKDAYS],
      pickupPeriods: [...TIME_SLOTS],
      dropoffDays: [...ISO_WEEKDAYS],
      dropoffPeriods: [...TIME_SLOTS],
      pickupClampedFrom: null,
    };
  }

  const pickup = resolveFlexible(timing.pickup, firstUsablePickup(now));
  const pickupStart = pickup.from ? new Date(pickup.from) : null;
  // A delivery cannot start before the pickup does.
  const dropoff = resolveFlexible(timing.dropoff, pickupStart);

  return {
    pickupFrom: pickup.from,
    pickupUntil: pickup.until,
    dropoffFrom: dropoff.from,
    dropoffUntil: dropoff.until,
    isFlexible: true,
    pickupDays: storedDays(timing.pickup),
    pickupPeriods: canonicalPeriods(timing.pickup.periods),
    dropoffDays: storedDays(timing.dropoff),
    dropoffPeriods: canonicalPeriods(timing.dropoff.periods),
    pickupClampedFrom: pickup.clamped ? pickup.from : null,
  };
}

export type ResolvedTiming = ReturnType<typeof resolveTimingWindows>;

/** The values `resolveTimingWindows` hands the form, without the display-only hint. */
export function timingFieldValues(resolved: ResolvedTiming) {
  const { pickupClampedFrom: _hint, ...values } = resolved;
  return values;
}

function defaultEndpointTiming(date: string): EndpointTiming {
  const slot: TimeSlot = "morning";
  return {
    date,
    dateUntil: date,
    slot,
    hour: defaultHourForSlot(slot),
    periods: [...TIME_SLOTS],
    days: [...ISO_WEEKDAYS],
  };
}

/** Sensible defaults: pickup tomorrow, delivery the day after. */
export function defaultTimingState(): TimingState {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();

  return {
    mode: "exact",
    pickup: defaultEndpointTiming(toDayString(new Date(now + day))),
    dropoff: defaultEndpointTiming(toDayString(new Date(now + 2 * day))),
  };
}

export { ISO_WEEKDAYS, TIME_SLOTS, type IsoWeekday, type TimeSlot };
