import { SLOT_HOURS, TIME_SLOTS, toDayString, type TimeSlot } from "@/lib/availability-window";
import { centsToInput, numberToInput } from "@/lib/numeric-input";
import type { DraftJob } from "@/features/app/listing/types";
import { splitFragileNote } from "./api/jobs.api";
import { bracketForWeight, sizeForDimensions } from "./cargo";
import type { JobFormValues, LocationType } from "./schemas";
import {
  EXACT_WINDOW_HOURS,
  ISO_WEEKDAYS,
  defaultHourForSlot,
  forInput,
  hourOptions,
  type EndpointTiming,
  type TimingState,
} from "./timing";

/**
 * A saved request back into the `/create` form, to finish it
 * (docs/specs/draft_requests_spec.md §2). The reverse of `toCreatePayload` and
 * `resolveTimingWindows`: round-tripping a stored row through the form posts
 * the same row back, which `from-listing.test.ts` holds it to.
 *
 * Pure: the clock and the language are passed in, so the mapping is the same
 * on any machine and in any test.
 */

/**
 * An exact time the form cannot show as saved, and the choice shown instead —
 * so the requester is told before anything is published at it: a minute off
 * the half-hour list, or a window other than the form's one hour (a draft
 * saved before either existed).
 */
export interface SnappedTime {
  side: "pickup" | "dropoff";
  /** « 09:15 », or « 09:00–17:00 » for a window: as saved. */
  saved: string;
  /** « 09:30 », or « 09:00–10:00 »: what the form now holds, as shown. */
  selected: string;
  /** « 09:30 »: the start the form holds — what "still selected" compares. */
  hour: string;
}

export interface ResumedForm {
  values: Partial<JobFormValues>;
  timing: TimingState;
  photos: string[];
  /** Empty unless a saved exact time had to move onto the list. */
  snappedTimes: SnappedTime[];
}

interface FromListingOptions {
  /** The requester's language: typed boxes hold « 45,5 » in French. */
  locale: string;
  now: Date;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The time of day an exact hour sits in; hours outside the three run to the nearest. */
function slotForHour(hour: number): TimeSlot {
  return (
    TIME_SLOTS.find((slot) => hour >= SLOT_HOURS[slot].start && hour < SLOT_HOURS[slot].end) ??
    (hour < SLOT_HOURS.morning.start ? "morning" : "evening")
  );
}

const minutesOf = (hour: string) => {
  const [h, m] = hour.split(":").map(Number);
  return h * 60 + m;
};

const clock = (at: Date) => `${pad(at.getHours())}:${pad(at.getMinutes())}`;

/** « 09:30 » → « 10:30 »: where the form's exact window ends. */
const windowEnd = (hour: string) => {
  const end = minutesOf(hour) + EXACT_WINDOW_HOURS * 60;
  return `${pad(Math.floor(end / 60))}:${pad(end % 60)}`;
};

const EXACT_WINDOW_MS = EXACT_WINDOW_HOURS * 60 * 60 * 1000;

/**
 * The list's choice nearest `hour` within its time of day. A tie goes to the
 * later one — a moment the requester had already said they would be there —
 * and a time outside the list's hours takes its nearest end: 05:00 → 06:00,
 * 22:30 → 21:30.
 */
function nearestHour(slot: TimeSlot, hour: string): string {
  const target = minutesOf(hour);
  return hourOptions(slot).reduce((best, option) =>
    Math.abs(minutesOf(option) - target) <= Math.abs(minutesOf(best) - target) ? option : best
  );
}

/** What moved, if anything, between the saved window and the form's. */
function movedTime(at: Date, until: Date, hour: string, side: SnappedTime["side"]) {
  const saved = clock(at);
  if (until.getTime() - at.getTime() !== EXACT_WINDOW_MS) {
    return { side, hour, saved: `${saved}–${clock(until)}`, selected: `${hour}–${windowEnd(hour)}` };
  }
  return hour === saved ? null : { side, hour, saved, selected: hour };
}

/** One end at its saved time, and what moved when the form cannot show it. */
function exactEndpoint(
  at: Date,
  until: Date,
  side: SnappedTime["side"]
): { endpoint: EndpointTiming; snapped: SnappedTime | null } {
  const slot = slotForHour(at.getHours());
  const hour = nearestHour(slot, clock(at));
  return {
    endpoint: {
      date: toDayString(at),
      dateUntil: toDayString(at),
      slot,
      hour,
      periods: [...TIME_SLOTS],
      days: [...ISO_WEEKDAYS],
    },
    snapped: movedTime(at, until, hour, side),
  };
}

function flexibleEndpoint(
  from: Date,
  until: Date,
  days: DraftJob["pickupDays"],
  periods: DraftJob["pickupPeriods"]
): EndpointTiming {
  return {
    date: toDayString(from),
    // A window ends at a period's close, 22:00 at the latest, so its last
    // instant is still on its last day.
    dateUntil: toDayString(until),
    slot: "morning",
    hour: defaultHourForSlot("morning"),
    periods: periods && periods.length > 0 ? [...periods] : [...TIME_SLOTS],
    days: days && days.length > 0 ? [...days] : [...ISO_WEEKDAYS],
  };
}

/**
 * The When step as it was saved. An exact time is snapped onto the half-hour
 * list — the form before it took any minute — and every one that moved is
 * named, so the form can open on that step and say so (draft_requests_spec.md
 * §2).
 */
export function timingFromListing(job: DraftJob): {
  timing: TimingState;
  snappedTimes: SnappedTime[];
} {
  const pickupFrom = new Date(job.pickupFrom);
  const dropoffFrom = new Date(job.dropoffFrom);
  if (!job.isFlexible) {
    const pickup = exactEndpoint(pickupFrom, new Date(job.pickupUntil), "pickup");
    const dropoff = exactEndpoint(dropoffFrom, new Date(job.dropoffUntil), "dropoff");
    return {
      timing: { mode: "exact", pickup: pickup.endpoint, dropoff: dropoff.endpoint },
      snappedTimes: [pickup.snapped, dropoff.snapped].filter(
        (time): time is SnappedTime => time !== null
      ),
    };
  }
  return {
    timing: {
      mode: "flexible",
      pickup: flexibleEndpoint(pickupFrom, new Date(job.pickupUntil), job.pickupDays, job.pickupPeriods),
      dropoff: flexibleEndpoint(dropoffFrom, new Date(job.dropoffUntil), job.dropoffDays, job.dropoffPeriods),
    },
    snappedTimes: [],
  };
}

/** One end of the stored request, as the Where step's fields hold it. */
function endpointValues(job: DraftJob, side: "pickup" | "dropoff") {
  const end =
    side === "pickup"
      ? {
          address: job.pickupAddress,
          city: job.pickupCity,
          postalCode: job.pickupPostalCode,
          lat: job.pickupLat,
          lng: job.pickupLng,
          locationType: job.pickupLocationType,
          floor: job.pickupFloor,
          hasLift: job.pickupHasLift,
          note: job.pickupNote,
          contactName: job.pickupContactName,
          contactPhone: job.pickupContactPhone,
        }
      : {
          address: job.dropoffAddress,
          city: job.dropoffCity,
          postalCode: job.dropoffPostalCode,
          lat: job.dropoffLat,
          lng: job.dropoffLng,
          locationType: job.dropoffLocationType,
          floor: job.dropoffFloor,
          hasLift: job.dropoffHasLift,
          note: job.dropoffNote,
          contactName: job.dropoffContactName,
          contactPhone: job.dropoffContactPhone,
        };

  return {
    address: end.address ?? "",
    city: end.city,
    postalCode: end.postalCode,
    lat: end.lat ?? undefined,
    lng: end.lng ?? undefined,
    locationType: end.locationType as LocationType,
    floor: end.floor ?? undefined,
    hasLift: end.hasLift ?? undefined,
    note: end.note ?? "",
    contactName: end.contactName ?? "",
    contactPhone: end.contactPhone ?? "",
    // Saved already: nothing to add to the address book on the way through.
    saveAddress: false,
    addressLabel: "",
  };
}

/**
 * The size as the step holds it. Exact measures go back as the boxes' own
 * text — a number would show « 45.5 » to a French requester until edited
 * (numeric_input_spec.md §7).
 */
function sizeValues(job: DraftJob, locale: string) {
  const { lengthCm, widthCm, heightCm, ...size } = sizeForDimensions(job);
  if (size.sizeMode !== "exact") return size;
  const text = (cm: number | undefined) => (cm === undefined ? "" : numberToInput(cm, 1, locale));
  return { ...size, lengthCm: text(lengthCm), widthCm: text(widthCm), heightCm: text(heightCm) };
}

/** A schedule still ahead is kept; one gone by asks again, like a draft. */
function publication(job: DraftJob, now: Date) {
  const scheduled = job.scheduledPublishAt ? new Date(job.scheduledPublishAt) : null;
  return job.status === "scheduled" && scheduled && scheduled > now
    ? { publishMode: "schedule" as const, scheduledPublishAt: forInput(scheduled.getTime()) }
    : { publishMode: "now" as const, scheduledPublishAt: "" };
}

export function fromListing(job: DraftJob, { locale, now }: FromListingOptions): ResumedForm {
  const photos = [...(job.photos ?? [])]
    .sort((a, b) => a.order - b.order)
    .map((photo) => photo.url);

  const values: Partial<JobFormValues> = {
    title: job.title,
    ...splitFragileNote(job.description, job.isFragile),
    ...bracketForWeight(job.weightKg),
    ...sizeValues(job, locale),
    quantity: job.quantity,
    isFragile: job.isFragile,
    needsHelp: job.needsHelp,
    packagingLevel: job.packagingLevel ?? undefined,
    needsProtection: job.needsProtection,
    needsPackaging: job.needsPackaging,
    pickup: endpointValues(job, "pickup"),
    dropoff: endpointValues(job, "dropoff"),
    budgetEuros: centsToInput(job.budgetCents, locale),
    photos,
    ...publication(job, now),
  };

  return { values, ...timingFromListing(job), photos };
}
