import { isOfferSlotDay } from "@/lib/offer-slots";

/**
 * The days the request assistant read out of a sentence, checked
 * (docs/specs/request_assistant_spec.md §4.6).
 *
 * The model resolves « le 20 », « demain », « vendredi prochain » against the
 * date it is given; this is what decides whether its answer is believed. A day
 * that fails is dropped — never moved to the nearest one that would pass: a
 * date nobody said is worse on a request than no date at all.
 *
 * "Today" is the day in France, where the requests are — not the server's,
 * which runs in UTC and is a day behind for the first hours of a French
 * morning. Pure: the clock is passed in. It lives here, not in
 * `jobFormSchema`, which may not compare a date with the clock.
 */

export const ASSISTANT_TIME_ZONE = "Europe/Paris";

/** How far ahead a stated day is still believed. */
export const ASSISTANT_DATE_HORIZON_MONTHS = 12;

/** `en-CA` writes a date as `YYYY-MM-DD`. */
const DAY_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: ASSISTANT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const WEEKDAY_FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: ASSISTANT_TIME_ZONE,
  weekday: "long",
});

/** The calendar day it is in France at `now`, as `YYYY-MM-DD`. */
export const parisDay = (now: Date) => DAY_FORMAT.format(now);

/** The weekday it is in France at `now`, in the prompt's language. */
export const parisWeekday = (now: Date) => WEEKDAY_FORMAT.format(now);

/**
 * The last day still believed: the same day of the month, twelve months on.
 * Compared as text, so it need not be a real date itself (29 February).
 */
function horizon(today: string): string {
  const [year, month, day] = today.split("-").map(Number);
  const months = month - 1 + ASSISTANT_DATE_HORIZON_MONTHS;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year + Math.floor(months / 12)}-${pad((months % 12) + 1)}-${pad(day)}`;
}

/** A real calendar day from `today` to the horizon, or nothing. */
export function statedDay(value: string | null, today: string): string | null {
  const day = value?.trim() ?? "";
  if (!isOfferSlotDay(day)) return null;
  return day >= today && day <= horizon(today) ? day : null;
}

export interface StatedDates {
  pickupDate: string | null;
  deliveryDate: string | null;
}

/**
 * Both days, each checked on its own and then against the other. A delivery
 * before its pickup means one of the two was misread and nothing says which,
 * so neither is kept.
 */
export function statedDates(
  model: { pickupDate: string | null; deliveryDate: string | null },
  now: Date
): StatedDates {
  const today = parisDay(now);
  const pickupDate = statedDay(model.pickupDate, today);
  const deliveryDate = statedDay(model.deliveryDate, today);
  if (pickupDate && deliveryDate && deliveryDate < pickupDate) {
    return { pickupDate: null, deliveryDate: null };
  }
  return { pickupDate, deliveryDate };
}
