import { decodePolyline } from "@/lib/polyline";
import type { RoutePlanInput } from "@/server/dto/route-plan.dto";

/**
 * The driver's route planner (client_feedback_2026_10_29_spec.md §N8): one
 * trip through the stops in the driver's order, timed twice — by the fastest
 * roads, motorways included, and avoiding motorways.
 *
 * Valhalla, because it can be asked to avoid motorways: the public OSRM server
 * the shipment map uses answers « Exclude flag combination is not supported »
 * to `exclude=motorway`. `VALHALLA_URL` points at the router; it defaults to
 * the FOSSGIS public server, which is for light use — a production host is an
 * Operator to-do, not a code change. Called from the server so the browser
 * never learns which router, and so it can be swapped in one place.
 */

export class RoutePlanError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message?: string
  ) {
    super(message ?? code);
    this.name = "RoutePlanError";
  }
}

const DEFAULT_VALHALLA_URL = "https://valhalla1.openstreetmap.de";
const TIMEOUT_MS = 20_000;

export interface PlannedRoute {
  distanceKm: number;
  durationMinutes: number;
  /** `[lng, lat]`, for MapLibre. */
  line: [number, number][];
}

export interface RoutePlan {
  withMotorway: PlannedRoute;
  withoutMotorway: PlannedRoute;
}

interface ValhallaTrip {
  trip?: {
    summary: { length: number; time: number };
    legs: { shape: string }[];
  };
  error?: string;
}

async function route(
  points: RoutePlanInput["points"],
  useHighways: number
): Promise<PlannedRoute> {
  const base = process.env.VALHALLA_URL || DEFAULT_VALHALLA_URL;
  const body = {
    locations: points.map((p) => ({ lat: p.lat, lon: p.lng })),
    costing: "auto",
    costing_options: { auto: { use_highways: useHighways } },
    directions_options: { units: "kilometers" },
  };
  const url = `${base}/route?json=${encodeURIComponent(JSON.stringify(body))}`;

  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new RoutePlanError("ROUTER_UNREACHABLE", 502);
  }
  const json = (await res.json().catch(() => ({}))) as ValhallaTrip;
  if (!res.ok || !json.trip) {
    // Valhalla says « No path could be found » for a point at sea or on an
    // island with no road: the driver's to fix, not ours.
    throw new RoutePlanError(res.status === 400 ? "NO_ROUTE" : "ROUTER_FAILED", res.status === 400 ? 422 : 502);
  }

  return {
    distanceKm: Math.round(json.trip.summary.length * 10) / 10,
    durationMinutes: Math.round(json.trip.summary.time / 60),
    line: json.trip.legs.flatMap((leg) => decodePolyline(leg.shape, 6)),
  };
}

export const routePlannerService = {
  /** Any signed-in carrier or driver; the route is theirs and stored nowhere. */
  async plan(
    viewer: { userId: string },
    input: RoutePlanInput
  ): Promise<RoutePlan> {
    if (!viewer.userId) throw new RoutePlanError("UNAUTHENTICATED", 401);
    const [withMotorway, withoutMotorway] = await Promise.all([
      route(input.points, 1),
      route(input.points, 0),
    ]);
    return { withMotorway, withoutMotorway };
  },
};
