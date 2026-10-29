/**
 * The stops of a planned trip (client_feedback_2026_10_29_spec.md §N8): the
 * driver's own runs, each a pickup and a delivery, plus any town they add, in
 * the order they choose. Pure, so the ordering rules are tested without a map.
 */

export interface PlanPoint {
  lat: number;
  lng: number;
}

export type PlanStop =
  | { key: string; kind: "pickup" | "dropoff"; runId: string; label: string; point: PlanPoint }
  | { key: string; kind: "stop"; label: string; point: PlanPoint };

/** Moves one stop up (-1) or down (+1); out of range changes nothing. */
export function moveStop(stops: PlanStop[], index: number, by: -1 | 1): PlanStop[] {
  const to = index + by;
  if (index < 0 || index >= stops.length || to < 0 || to >= stops.length) return stops;
  const next = [...stops];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

/**
 * The runs whose delivery comes before their pickup — a route that cannot be
 * driven as ordered. A run already picked up has no pickup stop, so it can
 * never be out of order.
 */
export function outOfOrder(stops: PlanStop[]): string[] {
  const seen = new Set<string>();
  const bad: string[] = [];
  for (const stop of stops) {
    if (stop.kind === "pickup") seen.add(stop.runId);
    if (stop.kind === "dropoff" && !seen.has(stop.runId)) {
      const pickupLater = stops.some((s) => s.kind === "pickup" && s.runId === stop.runId);
      if (pickupLater) bad.push(stop.runId);
    }
  }
  return bad;
}

/** Departure, the stops, then the arrival — what the router is asked. */
export function planPoints(
  departure: PlanPoint | null,
  stops: PlanStop[],
  arrival: PlanPoint | null
): PlanPoint[] {
  return [
    ...(departure ? [departure] : []),
    ...stops.map((s) => s.point),
    ...(arrival ? [arrival] : []),
  ];
}

/** « 5 h 43 », « 47 min ». */
export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}
