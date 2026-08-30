/**
 * "Sur mon trajet" — is a job on the way?
 *
 * A driver declaring Bordeaux → Paris wants loads that lie along that line and
 * travel in the same direction, not loads that merely start near Bordeaux. The
 * board had no way to express that: `carrier_trips_spec.md` §10.1 recorded the
 * missing two-endpoint filter as a known limitation. This is that filter.
 *
 * A trajet is a **path**, not a segment: a driver adding Limoges between
 * Bordeaux and Paris is describing a different corridor, and Cocolis's
 * "Ajouter une étape" is exactly that. Everything below therefore works on a
 * polyline; a plain two-city search is the one-segment case and needs no
 * special handling.
 *
 * Pure and dependency-free. `listings.dal.ts` transcribes the expressions below
 * into SQL from the path this module computes, so the projection, the
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
 * How many stops a trajet may name, the two ends included.
 *
 * Each leg costs a term in the SQL the DAL builds, so this is what keeps the
 * query finite. Three waypoints is already more than a day's driving.
 */
export const MAX_PATH_POINTS = 5;

/** One leg, projected to a local planar frame in kilometres. */
export interface CorridorSegment {
  /** Start of the leg. */
  ax: number;
  ay: number;
  /** End of the leg. */
  bx: number;
  by: number;
  /** |B−A|² in km². Zero when the two ends are the same place. */
  lengthSq: number;
  /** |B−A| in km. */
  lengthKm: number;
  /** Distance along the whole path at which this leg begins. */
  startKm: number;
}

/**
 * A trajet projected to a local planar frame, in kilometres.
 *
 * Equirectangular, scaled at the path's mean latitude: over a path no longer
 * than metropolitan France the error is well under a percent, which is the same
 * trade `distanceKmSql` already makes for radius search.
 */
export interface CorridorPath {
  segments: CorridorSegment[];
  totalKm: number;
  /** Longitude scaling, as SQL needs it verbatim. */
  lngScale: number;
}

export function corridorPath(points: readonly LatLng[]): CorridorPath {
  const meanLat =
    points.reduce((sum, point) => sum + point.lat, 0) / points.length;
  const lngScale = Math.cos((meanLat * Math.PI) / 180) * KM_PER_DEGREE;

  const segments: CorridorSegment[] = [];
  let startKm = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const ax = points[i].lng * lngScale;
    const ay = points[i].lat * KM_PER_DEGREE;
    const bx = points[i + 1].lng * lngScale;
    const by = points[i + 1].lat * KM_PER_DEGREE;

    const dx = bx - ax;
    const dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    const lengthKm = Math.sqrt(lengthSq);

    segments.push({ ax, ay, bx, by, lengthSq, lengthKm, startKm });
    startKm += lengthKm;
  }

  // A path of one point describes no direction, only a place. Its single
  // zero-length segment turns every distance below into distance from that
  // point, which is the honest reading of "my trajet is here".
  if (segments.length === 0) {
    const ax = points[0].lng * lngScale;
    const ay = points[0].lat * KM_PER_DEGREE;
    segments.push({
      ax,
      ay,
      bx: ax,
      by: ay,
      lengthSq: 0,
      lengthKm: 0,
      startKm: 0,
    });
  }

  return { segments, totalKm: startKm, lngScale };
}

export interface CorridorPosition {
  /** Kilometres off the nearest leg. */
  detourKm: number;
  /** How far along the whole path that leg puts it, in kilometres. */
  progressKm: number;
}

/**
 * Where a point sits relative to one leg.
 *
 * A zero-length leg — the driver typed one city into both fields — yields plain
 * distance from its start, which is the limit of point-to-segment distance as
 * the end approaches the start. That is the right answer rather than a guard,
 * so no caller needs a special case.
 */
export function positionOnSegment(
  segment: CorridorSegment,
  point: LatLng,
  lngScale: number
): CorridorPosition {
  const px = point.lng * lngScale;
  const py = point.lat * KM_PER_DEGREE;

  const dx = segment.bx - segment.ax;
  const dy = segment.by - segment.ay;

  const t =
    segment.lengthSq === 0
      ? 0
      : clamp(
          ((px - segment.ax) * dx + (py - segment.ay) * dy) / segment.lengthSq
        );

  const offX = px - (segment.ax + t * dx);
  const offY = py - (segment.ay + t * dy);

  return {
    detourKm: Math.hypot(offX, offY),
    progressKm: segment.startKm + t * segment.lengthKm,
  };
}

/**
 * Where a point sits relative to the whole trajet: the nearest leg wins, and
 * reports how far along the path that leg places it.
 */
export function positionOnPath(
  path: CorridorPath,
  point: LatLng
): CorridorPosition {
  let best: CorridorPosition | null = null;

  for (const segment of path.segments) {
    const position = positionOnSegment(segment, point, path.lngScale);
    if (best === null || position.detourKm < best.detourKm) best = position;
  }

  return best!;
}

/**
 * Is this job worth the detour?
 *
 * Both ends must sit inside the corridor, and the load must travel the driver's
 * way: a Bordeaux → Paris driver is offered Angoulême → Orléans and never
 * Orléans → Angoulême. With waypoints the same rule reads along the whole
 * path, so a load may not double back through an étape either.
 */
export function isOnPath(
  path: CorridorPath,
  pickup: LatLng,
  dropoff: LatLng,
  radiusKm: number
): boolean {
  const start = positionOnPath(path, pickup);
  const end = positionOnPath(path, dropoff);

  return (
    start.detourKm <= radiusKm &&
    end.detourKm <= radiusKm &&
    start.progressKm <= end.progressKm
  );
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));
