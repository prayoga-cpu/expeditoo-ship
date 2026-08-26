/**
 * Turning a declared trip into a job-board query.
 *
 * There is no matching engine: `browseListingsQuerySchema` already accepts
 * every parameter produced here, so a saved trip is a saved query
 * (docs/specs/carrier_trips_spec.md §7). Pure and dependency-free so the card
 * that renders the link and the service that owns the rule agree by
 * construction rather than by copy.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Dates arrive as `Date` from the DAL and as ISO strings from the REST layer. */
export type DateLike = Date | string;

const asDate = (value: DateLike) =>
  value instanceof Date ? value : new Date(value);

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const endOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

/** JS Sunday is 0; the schema stores ISO weekdays, where Sunday is 7. */
const isoWeekday = (date: Date) => date.getDay() || 7;

export interface MatchableRoute {
  kind: "recurring" | "occasional";
  daysOfWeek: number[];
  dates: { date: DateLike }[];
  validFrom: DateLike | null;
  validUntil: DateLike | null;
  originLat: number;
  originLng: number;
  radiusKm: number;
  capacityKg: number | null;
}

/**
 * The next day this trip runs, or null when every occurrence has elapsed.
 *
 * Occasional trips answer their earliest date that has not passed. Recurring
 * trips walk forward from today to the first matching weekday inside the
 * validity window.
 */
export function nextOccurrence(
  route: Pick<
    MatchableRoute,
    "kind" | "daysOfWeek" | "dates" | "validFrom" | "validUntil"
  >,
  now = new Date()
): Date | null {
  const today = startOfDay(now);

  if (route.kind === "occasional") {
    const upcoming = route.dates
      .map((entry) => asDate(entry.date))
      .filter((date) => startOfDay(date) >= today)
      .sort((a, b) => a.getTime() - b.getTime());

    return upcoming[0] ?? null;
  }

  if (route.daysOfWeek.length === 0) return null;

  const until = route.validUntil ? asDate(route.validUntil) : null;
  if (until && startOfDay(until) < today) return null;

  const from = route.validFrom ? startOfDay(asDate(route.validFrom)) : today;
  const start = from > today ? from : today;

  // At most one full week separates any day from the next matching weekday.
  for (let offset = 0; offset < 7; offset++) {
    const candidate = new Date(start.getTime() + offset * DAY_MS);
    if (!route.daysOfWeek.includes(isoWeekday(candidate))) continue;
    if (until && candidate > endOfDay(until)) return null;
    return candidate;
  }

  return null;
}

/**
 * A trip rendered as the board's own query parameters.
 *
 * The destination is deliberately not a filter: the board has no two-endpoint
 * predicate, and distance from the origin is the honest approximation
 * (carrier_trips_spec.md §7, §10).
 */
export function routeMatchQuery(
  route: MatchableRoute,
  now = new Date()
): Record<string, string> {
  const query: Record<string, string> = {
    nearLat: String(route.originLat),
    nearLng: String(route.originLng),
    radiusKm: String(route.radiusKm),
    sort: "distance_asc",
  };

  if (route.capacityKg !== null && route.capacityKg !== undefined) {
    query.maxWeightKg = String(route.capacityKg);
  }

  const occurrence = nextOccurrence(route, now);
  if (occurrence) {
    query.pickupFrom = startOfDay(occurrence).toISOString();
    query.pickupUntil = endOfDay(occurrence).toISOString();
  }

  return query;
}

/** The board link a trip card points at. */
export function routeMatchHref(route: MatchableRoute, now = new Date()) {
  return `/expedion?${new URLSearchParams(routeMatchQuery(route, now)).toString()}`;
}
