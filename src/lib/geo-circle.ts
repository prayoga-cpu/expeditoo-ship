/**
 * A circle on the map as a GeoJSON ring (client_feedback_2026_10_29_spec.md
 * §D2): the area « Autour de » searches, drawn rather than described.
 *
 * Computed on a sphere from the centre, so 50 km reads 50 km at any latitude
 * France spans — an ellipse in degrees, a circle on the ground.
 */

const EARTH_RADIUS_KM = 6371;

export function circleRing(
  center: { lat: number; lng: number },
  radiusKm: number,
  steps = 64
): [number, number][] {
  const lat1 = (center.lat * Math.PI) / 180;
  const lng1 = (center.lng * Math.PI) / 180;
  const angular = radiusKm / EARTH_RADIUS_KM;
  const ring: [number, number][] = [];

  for (let i = 0; i <= steps; i++) {
    const bearing = (2 * Math.PI * i) / steps;
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angular) +
        Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing)
    );
    const lng2 =
      lng1 +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
        Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2)
      );
    ring.push([(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI]);
  }
  return ring;
}

/** The ring's bounding box, for framing it. */
export function ringBounds(ring: [number, number][]): [[number, number], [number, number]] {
  const lngs = ring.map((p) => p[0]);
  const lats = ring.map((p) => p[1]);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}
