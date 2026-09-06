/**
 * The reverse of "sur mon trajet": given a job, does this declared trajet cover it?
 *
 * `route-corridor.ts` answers the carrier's question — which jobs lie along the
 * path I drive. This answers the requester's — which carriers drive along the
 * path my goods take. It is the same geometry read from the other side, so
 * nothing here re-derives it: `isOnPath` decides the corridor test and
 * `upcomingOccurrences` decides the calendar one. The point-to-segment
 * arithmetic exists in exactly the two places `board_route_search_spec.md` §4.2
 * allows, and this is neither of them.
 *
 * **This function is the whole predicate.** The DAL narrows the candidate set
 * with bounding boxes it can express in SQL, but that is an optimisation and
 * may never change an answer — anything the prefilter admits is decided here.
 *
 * Pure and dependency-free. See docs/specs/carriers_on_route_spec.md §3.
 */

import {
  corridorPath,
  isOnPath,
  positionOnPath,
  type LatLng,
} from "./route-corridor";
import {
  upcomingOccurrences,
  type DateLike,
  type MatchableRoute,
} from "./carrier-route-matching";

/** Rows the SQL prefilter may hand back before the real predicate runs. */
export const MAX_MATCH_CANDIDATES = 500;

/** Carriers returned to the client, after deduplication. */
export const MAX_MATCHES = 30;

/** Run dates carried on one card. */
export const MAX_RUNS_SHOWN = 3;

/** The job, as the predicate needs it. */
export interface MatchTarget {
  pickup: LatLng;
  dropoff: LatLng;
  pickupFrom: DateLike;
  pickupUntil: DateLike;
  weightKg: number;
}

export interface RouteMatch {
  /**
   * How far off the trajet the job sits — the **worse** of its two endpoints,
   * so a match cannot rank well on one end alone.
   */
  detourKm: number;
  /** Runs inside the job's window, soonest first, capped at `MAX_RUNS_SHOWN`. */
  runs: Date[];
}

/** Everything `matchRoute` reads. A trajet row satisfies it structurally. */
export type MatchableTrajet = Pick<
  MatchableRoute,
  | "kind"
  | "daysOfWeek"
  | "dates"
  | "validFrom"
  | "validUntil"
  | "originLat"
  | "originLng"
  | "destinationLat"
  | "destinationLng"
  | "radiusKm"
  | "capacityKg"
>;

const asDate = (value: DateLike) =>
  value instanceof Date ? value : new Date(value);

/**
 * Does this trajet cover this job, and when?
 *
 * Null on any failure — off the corridor, travelling the wrong way, too heavy,
 * or not running inside the job's pickup window.
 */
export function matchRoute(
  route: MatchableTrajet,
  job: MatchTarget,
  now = new Date()
): RouteMatch | null {
  if (route.capacityKg !== null && route.capacityKg < job.weightKg) return null;

  const path = corridorPath([
    { lat: route.originLat, lng: route.originLng },
    { lat: route.destinationLat, lng: route.destinationLng },
  ]);

  // Both ends within the carrier's own declared tolerance, and the load
  // travelling their way. `isOnPath` owns that rule; this file does not repeat it.
  if (!isOnPath(path, job.pickup, job.dropoff, route.radiusKm)) return null;

  const runs = runsInWindow(route, job, now);
  if (runs.length === 0) return null;

  return {
    detourKm: Math.max(
      positionOnPath(path, job.pickup).detourKm,
      positionOnPath(path, job.dropoff).detourKm
    ),
    runs: runs.slice(0, MAX_RUNS_SHOWN),
  };
}

/**
 * The trajet's runs that fall inside the job's pickup window.
 *
 * `upcomingOccurrences` floors its `now` to the start of a day and caps what it
 * walks relative to it, so starting the walk at the later of today and the
 * window's opening keeps both caps harmless: any run inside the window is among
 * the first it finds. The helper is used as it stands.
 */
function runsInWindow(
  route: MatchableTrajet,
  job: MatchTarget,
  now: Date
): Date[] {
  const from = asDate(job.pickupFrom);
  const until = asDate(job.pickupUntil);
  const start = now > from ? now : from;

  return upcomingOccurrences(route, start).filter((run) => run <= until);
}
