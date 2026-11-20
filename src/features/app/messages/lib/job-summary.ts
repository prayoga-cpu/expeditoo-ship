/**
 * How a conversation names the job it is about: « Paris → Lyon » and
 * « 20 nov. – 22 nov. » (client feedback 2026-11, #25/#31/#34).
 *
 * Towns and days only. Nothing here takes a street, a postal code or a time of
 * day: the inbox and the thread header are read by both sides of a job, and
 * the payload they are built from carries nothing finer (listing_privacy_spec.md).
 */

export const routeOf = (from?: string | null, to?: string | null) =>
  from && to ? `${from} → ${to}` : null;

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/**
 * The pickup day, then the delivery day; one date when they are the same day.
 * The year is written only when it is not the current one, so an old thread
 * does not read as this month's.
 */
export function jobDates(
  pickup: string | null | undefined,
  delivery: string | null | undefined,
  locale: string,
  now: Date = new Date()
): string | null {
  if (!pickup) return null;
  const from = new Date(pickup);
  if (Number.isNaN(from.getTime())) return null;
  const parsed = delivery ? new Date(delivery) : from;
  const to = Number.isNaN(parsed.getTime()) ? from : parsed;

  const day = (date: Date) =>
    new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
    }).format(date);

  return sameDay(from, to) ? day(from) : `${day(from)} – ${day(to)}`;
}

/** « Paris → Lyon · 20 nov. – 22 nov. », or whichever half is known. */
export const jobLine = (route?: string | null, dates?: string | null) =>
  [route, dates].filter(Boolean).join(" · ") || null;
