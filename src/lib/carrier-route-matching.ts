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
  originCity: string;
  originLat: number;
  originLng: number;
  destinationCity: string;
  destinationLat: number;
  destinationLng: number;
  radiusKm: number;
  capacityKg: number | null;
}

/**
 * How many upcoming runs a deep link carries.
 *
 * Enough for a recurring trip to reach a month out on a twice-weekly pattern,
 * short of the board's 31-day cap, and short enough that the URL stays
 * readable.
 */
export const MAX_DEEP_LINK_DAYS = 8;

/** How far ahead a recurring trip is walked looking for those runs. */
const DEEP_LINK_HORIZON_DAYS = 56;

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
 * The runs of this trip a driver could still take, soonest first.
 *
 * `nextOccurrence` answers one; the board filters on a set, and a trip that
 * runs every Monday and Thursday is badly served by being shown one Monday.
 * Capped at `MAX_DEEP_LINK_DAYS` and walked no further than the horizon.
 */
export function upcomingOccurrences(
  route: Pick<
    MatchableRoute,
    "kind" | "daysOfWeek" | "dates" | "validFrom" | "validUntil"
  >,
  now = new Date()
): Date[] {
  const today = startOfDay(now);

  if (route.kind === "occasional") {
    return route.dates
      .map((entry) => asDate(entry.date))
      .filter((date) => startOfDay(date) >= today)
      .sort((a, b) => a.getTime() - b.getTime())
      .slice(0, MAX_DEEP_LINK_DAYS);
  }

  if (route.daysOfWeek.length === 0) return [];

  const until = route.validUntil ? asDate(route.validUntil) : null;
  if (until && startOfDay(until) < today) return [];

  const from = route.validFrom ? startOfDay(asDate(route.validFrom)) : today;
  const start = from > today ? from : today;

  const found: Date[] = [];
  for (
    let offset = 0;
    offset < DEEP_LINK_HORIZON_DAYS && found.length < MAX_DEEP_LINK_DAYS;
    offset++
  ) {
    const candidate = new Date(start.getTime() + offset * DAY_MS);
    if (until && candidate > endOfDay(until)) break;
    if (route.daysOfWeek.includes(isoWeekday(candidate))) found.push(candidate);
  }

  return found;
}

/**
 * A trip rendered as the board's own query parameters.
 *
 * There is still no matching engine: `browseListingsQuerySchema` accepts every
 * parameter produced here, so a saved trip remains a saved query
 * (carrier_trips_spec.md §7).
 *
 * The destination **is** a filter now. It was not, because the board had no
 * two-endpoint predicate and distance from the origin was the honest
 * approximation; the board grew one, so a Bordeaux → Paris trip searches the
 * Bordeaux → Paris corridor rather than a circle around Bordeaux
 * (board_route_search_spec.md §4).
 */
export function routeMatchQuery(
  route: MatchableRoute,
  now = new Date()
): Record<string, string> {
  const query: Record<string, string> = {
    fromLat: String(route.originLat),
    fromLng: String(route.originLng),
    fromLabel: route.originCity,
    toLat: String(route.destinationLat),
    toLng: String(route.destinationLng),
    toLabel: route.destinationCity,
    radiusKm: String(route.radiusKm),
    sort: "distance_asc",
  };

  if (route.capacityKg !== null && route.capacityKg !== undefined) {
    query.maxWeightKg = String(route.capacityKg);
  }

  const runs = upcomingOccurrences(route, now);
  if (runs.length > 0) {
    query.days = runs.map(toLocalDay).join(",");
  }

  return query;
}

/** The board link a trip card points at. */
export function routeMatchHref(route: MatchableRoute, now = new Date()) {
  return `/expedion?${new URLSearchParams(routeMatchQuery(route, now)).toString()}`;
}

/** `YYYY-MM-DD` in the local calendar — `toISOString` would shift the day. */
const toLocalDay = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const pad = (value: number) => String(value).padStart(2, "0");
