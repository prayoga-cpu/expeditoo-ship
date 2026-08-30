/**
 * "When can you do it?" — answered more than once.
 *
 * A carrier's offer used to name a single pickup datetime, so a driver free on
 * the 25th *or* the 27th had to pick one and hope. An offer now proposes
 * several `(day, time of day)` slots and whoever awards the job books exactly
 * one of them.
 *
 * The vocabulary is the board search's own — a driver who filtered for
 * "mornings on the 2nd and 3rd" proposes in the same words. Pure and
 * dependency-free, like `availability-window.ts` it builds on.
 *
 * See docs/specs/offer_time_slots_spec.md §3.
 */

import {
  SLOT_HOURS,
  TIME_SLOTS,
  isAvailabilityDay,
  slotInterval,
  type Interval,
  type TimeSlot,
} from "./availability-window";

/**
 * Four days, three periods. A driver naming more than four days is not
 * proposing a slot any more, they are publishing their diary — which is what
 * the board's availability filter is for.
 */
export const MAX_OFFER_SLOT_DAYS = 4;
export const MAX_OFFER_SLOTS = MAX_OFFER_SLOT_DAYS * TIME_SLOTS.length;

/** A week is already generous for domestic road transport. */
export const MAX_DELIVERY_LEAD_DAYS = 7;

/**
 * The hour a day's delivery promise falls due, local. It is the end of the
 * last slot rather than midnight, because 22:00 is the latest hour this
 * vocabulary knows how to say.
 */
export const DELIVERY_DEADLINE_HOUR = SLOT_HOURS.evening.end;

/** What the driver picked: a day and a time of day. */
export interface OfferSlotInput {
  day: string;
  slot: TimeSlot;
}

/** The same pair, as the instants the server compares and stores. */
export interface ResolvedOfferSlot extends OfferSlotInput {
  startsAt: Date;
  endsAt: Date;
  /** What this slot promises delivery by, given the offer's lead. */
  deliveryAt: Date;
}

export const slotKey = ({ day, slot }: OfferSlotInput) => `${day}:${slot}`;

/**
 * A real calendar day, not merely a well-shaped string.
 *
 * The shape check alone lets `2026-02-31` through, and `Date.UTC` rolls it
 * silently into 3 March — so the row's `day` would disagree with its own
 * instants, and every screen that renders the words would name a different day
 * from the one the job was scheduled for.
 */
export function isOfferSlotDay(value: string): boolean {
  if (!isAvailabilityDay(value)) return false;
  const [year, month, date] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, date));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === date
  );
}

/** How many distinct days a proposal covers. */
export const slotDayCount = (slots: readonly OfferSlotInput[]) =>
  new Set(slots.map((s) => s.day)).size;

export const hasDuplicateSlots = (slots: readonly OfferSlotInput[]) =>
  new Set(slots.map(slotKey)).size !== slots.length;

/** The job's collection window, as the offer form knows it. */
export interface PickupWindow {
  from: Date;
  until: Date;
  isFlexible: boolean;
}

/**
 * Which periods on this day the server would actually accept.
 *
 * The two refusals a driver can walk into are `SLOT_IN_PAST` and
 * `PICKUP_OUTSIDE_WINDOW`, and both are decided per *slot* while the calendar
 * can only gate whole *days*. Asking the same question the service asks, at the
 * same granularity, is what keeps the form from proposing something it already
 * knows will be refused whole — an offer is refused entire, not slot by slot,
 * so one bad period costs the driver the whole bid.
 */
export function offerablePeriods(
  day: string,
  window: PickupWindow,
  now: Date,
  tzOffsetMinutes: number
): TimeSlot[] {
  if (!isOfferSlotDay(day)) return [];

  return TIME_SLOTS.filter((slot) => {
    const interval = slotInterval(day, slot, tzOffsetMinutes);
    if (interval.end <= now) return false;
    return window.isFlexible || overlapsWindow(interval, window);
  });
}

/**
 * The proposal after the driver changes which days they are offering.
 *
 * A day they already had keeps the periods they narrowed it to; a day they
 * just added arrives with **all three** — "le 25/08 en journée", the reading
 * the client's own reference gives, and the permissive one to narrow from. It
 * is also what leaves the control with no invalid state to report: a day with
 * no period is a day removed, not a day in error.
 */
export function slotsForDays(
  existing: readonly OfferSlotInput[],
  days: readonly string[],
  offerable: (day: string) => readonly TimeSlot[] = () => TIME_SLOTS
): OfferSlotInput[] {
  const kept = new Map<string, TimeSlot[]>();
  for (const { day, slot } of existing) {
    kept.set(day, [...(kept.get(day) ?? []), slot]);
  }

  return [...days]
    .sort()
    .flatMap((day) => {
      // A day already chosen keeps what the driver narrowed it to; a new one
      // takes every period the server would accept, which on a boundary day is
      // narrower than "en journée".
      const periods = kept.get(day) ?? offerable(day);
      return TIME_SLOTS.filter((slot) => periods.includes(slot)).map((slot) => ({
        day,
        slot,
      }));
    });
}

/**
 * When a slot picked on `day` promises delivery.
 *
 * One control rather than a second calendar: the lead says how many days after
 * collection the goods arrive, and the promise is the end of that day. A
 * morning pickup delivered "le jour même" is therefore due at 22:00, not at
 * 12:00 when the slot itself closes — nobody collecting at 11:00 has delivered
 * by noon.
 *
 * Always later than the slot's start, because no slot begins after 18:00. That
 * is what makes a delivery-before-pickup offer unrepresentable rather than
 * merely refused.
 */
export function deliveryInstant(
  day: string,
  leadDays: number,
  tzOffsetMinutes: number
): Date {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(
    Date.UTC(year, month - 1, date + leadDays, DELIVERY_DEADLINE_HOUR) +
      tzOffsetMinutes * 60_000
  );
}

/** A day string shifted by whole days, staying a day string. */
export function addDays(day: string, days: number): string {
  const [year, month, date] = day.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, date + days));
  return [
    shifted.getUTCFullYear(),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

/**
 * The proposal as instants, earliest first.
 *
 * `tzOffsetMinutes` is the driver's `Date.prototype.getTimezoneOffset()`.
 * Production runs `TZ=UTC`, so without it a French driver's 06:00 would be
 * stored as 08:00 — and resolving here, once, is what spares every later
 * reader from needing to know the driver's timezone at all.
 */
export function resolveOfferSlots(
  slots: readonly OfferSlotInput[],
  leadDays: number,
  tzOffsetMinutes: number
): ResolvedOfferSlot[] {
  return slots
    .map(({ day, slot }) => {
      const { start, end } = slotInterval(day, slot, tzOffsetMinutes);
      return {
        day,
        slot,
        startsAt: start,
        endsAt: end,
        deliveryAt: deliveryInstant(day, leadDays, tzOffsetMinutes),
      };
    })
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/**
 * Does this slot overlap the job's pickup window?
 *
 * Overlap, not containment — the same rule the board filter applies
 * (board_route_search_spec.md §5). A morning against a window that opens at
 * 09:00 is a real proposal, and demanding containment would mean no driver
 * could ever offer the first morning of a job.
 */
export const overlapsWindow = (
  slot: { startsAt: Date; endsAt: Date } | Interval,
  window: { from: Date; until: Date }
) => {
  const start = "startsAt" in slot ? slot.startsAt : slot.start;
  const end = "endsAt" in slot ? slot.endsAt : slot.end;
  return start < window.until && end > window.from;
};
