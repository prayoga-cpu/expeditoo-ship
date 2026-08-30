/**
 * "Sur mon trajet" — is a job on the way?
 *
 * A driver declaring Bordeaux → Paris wants loads that lie along that line and
 * travel in the same direction, not loads that merely start near Bordeaux. The
 * board had no way to express that: `carrier_trips_spec.md` §10.1 recorded the
 * missing two-endpoint filter as a known limitation. This is that filter.
 *
 * Pure and dependency-free. `listings.dal.ts` transcribes the expression below
 * into SQL from the frame this module computes, so the projection, the
 * mid-latitude scaling and the clamp are written once and only the
 * point-to-segment arithmetic exists in both languages.
 *
 * See docs/specs/board_route_search_spec.md §4.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** Kilometres per degree of latitude. Longitude is this scaled by cos(lat). */
export const KM_PER_DEGREE = 111.32;

/**
 * A corridor projected to a local planar frame, in kilometres.
 *
 * Equirectangular, scaled at the corridor's mid latitude: over a segment no
 * longer than metropolitan France the error is well under a percent, which is
 * the same trade `distanceKmSql` already makes for radius search.
 */
export interface CorridorFrame {
  /** Departure, projected. */
  ax: number;
  ay: number;
  /** Arrival, projected. */
  bx: number;
  by: number;
  /** |B−A|² in km². Zero when the two ends are the same place. */
  lengthSq: number;
  /** Longitude scaling at the mid latitude, as SQL needs it verbatim. */
  lngScale: number;
}

export function corridorFrame(from: LatLng, to: LatLng): CorridorFrame {
  const midLat = (from.lat + to.lat) / 2;
  const lngScale = Math.cos((midLat * Math.PI) / 180) * KM_PER_DEGREE;

  const ax = from.lng * lngScale;
  const ay = from.lat * KM_PER_DEGREE;
  const bx = to.lng * lngScale;
  const by = to.lat * KM_PER_DEGREE;

  const dx = bx - ax;
  const dy = by - ay;

  return { ax, ay, bx, by, lengthSq: dx * dx + dy * dy, lngScale };
}

export interface CorridorPosition {
  /** Kilometres off the corridor. */
  detourKm: number;
  /** How far along it, 0 at the departure and 1 at the arrival. */
  progress: number;
}

/**
 * Where a point sits relative to the corridor.
 *
 * A zero-length corridor — the driver typed one city into both fields — yields
 * plain distance from the departure point, which is the limit of
 * point-to-segment distance as the arrival approaches the departure. That is
 * the right answer rather than a guard, so the caller needs no special case.
 */
export function positionOnCorridor(
  frame: CorridorFrame,
  point: LatLng
): CorridorPosition {
  const px = point.lng * frame.lngScale;
  const py = point.lat * KM_PER_DEGREE;

  const dx = frame.bx - frame.ax;
  const dy = frame.by - frame.ay;

  const progress =
    frame.lengthSq === 0
      ? 0
      : clamp(((px - frame.ax) * dx + (py - frame.ay) * dy) / frame.lengthSq);

  const offX = px - (frame.ax + progress * dx);
  const offY = py - (frame.ay + progress * dy);

  return { detourKm: Math.hypot(offX, offY), progress };
}

/**
 * Is this job worth the detour?
 *
 * Both ends must sit inside the corridor, and the load must travel the driver's
 * way: a Bordeaux → Paris driver is offered Angoulême → Orléans and never
 * Orléans → Angoulême.
 */
export function isOnCorridor(
  frame: CorridorFrame,
  pickup: LatLng,
  dropoff: LatLng,
  radiusKm: number
): boolean {
  const start = positionOnCorridor(frame, pickup);
  const end = positionOnCorridor(frame, dropoff);

  return (
    start.detourKm <= radiusKm &&
    end.detourKm <= radiusKm &&
    start.progress <= end.progress
  );
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));
