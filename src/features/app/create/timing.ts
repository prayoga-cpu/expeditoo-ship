import { SLOT_HOURS, TIME_SLOTS, toDayString, type TimeSlot } from "@/lib/availability-window";

/**
 * How a requester states when a job happens, translated into the four
 * `pickupFrom` / `pickupUntil` / `dropoffFrom` / `dropoffUntil` instants and
 * the `isFlexible` flag `jobFormSchema` and `createListingSchema` already
 * validate — see `src/features/app/create/schemas.ts`. Nothing here is a new
 * wire field; it is the same seam `toCreatePayload` already uses for
 * `weightBracket` and `sizePreset` (docs/specs/cargo_input_spec.md §2), applied
 * to timing instead.
 *
 * `exact` names one instant per endpoint — a date, a time of day, and an hour
 * within it — and turns it into a one-hour arrival window, because the schema
 * requires `pickupFrom < pickupUntil` and a person does not think in windows
 * when they mean "9 o'clock". `flexible` names a date range instead, with an
 * optional time-of-day preference; `isFlexible: true` is what already tells
 * `offers.service.ts` a carrier may propose outside it altogether
 * (see `offersService.submitOffer`), so the range here is a preference, not a
 * hard boundary.
 */

export const TIMING_MODES = ["exact", "flexible"] as const;
export type TimingMode = (typeof TIMING_MODES)[number];

/** How wide the arrival window is around an exact time. */
const EXACT_WINDOW_HOURS = 1;

/** A day with no preference stated: the whole day is offerable. */
const ANY_TIME_START_HOUR = 0;
const ANY_TIME_END = "23:59";

export interface EndpointTiming {
  /** Exact mode: the day. Flexible mode: the range's start day. */
  date: string;
  /** Flexible mode only: the range's end day. */
  dateUntil: string;
  /** The time-of-day chosen (exact mode) or last chosen (flexible mode). */
  slot: TimeSlot;
  /** Flexible mode only: whether `slot` narrows the range or is ignored. */
  hasSlotPreference: boolean;
  /** Exact mode only: "HH:mm" within `slot`'s hours. */
  hour: string;
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

function resolveFrom(mode: TimingMode, endpoint: EndpointTiming): string {
  if (mode === "exact") return `${endpoint.date}T${endpoint.hour}`;
  const hour = endpoint.hasSlotPreference
    ? SLOT_HOURS[endpoint.slot].start
    : ANY_TIME_START_HOUR;
  return `${endpoint.date}T${pad(hour)}:00`;
}

function resolveUntil(mode: TimingMode, endpoint: EndpointTiming): string {
  if (mode === "exact") {
    return addHours(`${endpoint.date}T${endpoint.hour}`, EXACT_WINDOW_HOURS);
  }
  if (!endpoint.hasSlotPreference) return `${endpoint.dateUntil}T${ANY_TIME_END}`;
  return `${endpoint.dateUntil}T${pad(SLOT_HOURS[endpoint.slot].end)}:00`;
}

/** The four dates and the flag the underlying form fields hold. */
export function resolveTimingWindows(timing: TimingState) {
  return {
    pickupFrom: resolveFrom(timing.mode, timing.pickup),
    pickupUntil: resolveUntil(timing.mode, timing.pickup),
    dropoffFrom: resolveFrom(timing.mode, timing.dropoff),
    dropoffUntil: resolveUntil(timing.mode, timing.dropoff),
    isFlexible: timing.mode === "flexible",
  };
}

function defaultEndpointTiming(date: string): EndpointTiming {
  const slot: TimeSlot = "morning";
  return {
    date,
    dateUntil: date,
    slot,
    hasSlotPreference: false,
    hour: defaultHourForSlot(slot),
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

export { TIME_SLOTS, type TimeSlot };
