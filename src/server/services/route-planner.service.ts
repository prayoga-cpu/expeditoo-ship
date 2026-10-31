import { decodePolyline } from "@/lib/polyline";
import type { RoutePlanInput } from "@/server/dto/route-plan.dto";

/**
 * The driver's route planner (client_feedback_2026_10_29_spec.md §N8): one
 * trip through the stops in the driver's order, timed twice — by the fastest
 * roads, motorways included, and avoiding motorways.
 *
 * Valhalla, because it can be asked to avoid motorways: the public OSRM server
 * the shipment map uses answers « Exclude flag combination is not supported »
 * to `exclude=motorway`. Called from the server so the browser never learns
 * which router, and so it can be swapped in one place:
 *
 * - `VALHALLA_ROUTE_URL` — the full `/route` endpoint. Defaults to the FOSSGIS
 *   public server, whose fair-use terms are about one request a second per
 *   caller (bursts of ten), a User-Agent naming the app, and OpenStreetMap
 *   attribution; it is best-effort and not meant for heavy production use.
 * - `VALHALLA_API_KEY` — sent as `api_key`, for a hosted Valhalla such as
 *   Stadia Maps (`https://api-eu.stadiamaps.com/route/v1`, EU-hosted).
 *
 * Not `@valhallajs/valhallajs`: those Node bindings are 261 MB of native code
 * that route over tiles built from OpenStreetMap data — several GB for France
 * — and a Vercel function is capped at 250 MB (client_feedback_2026_10_29_spec
 * .md §N8). They belong on a router of our own, if we ever run one.
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

const DEFAULT_ROUTE_URL = "https://valhalla1.openstreetmap.de/route";
const TIMEOUT_MS = 20_000;
/** FOSSGIS asks every caller to name itself. */
const USER_AGENT = "Expeditoo route planner (+https://expeditoo-ship-five.vercel.app)";

/** The endpoint, with the hosted provider's key when there is one. */
export function routeEndpoint(): string {
  const url = process.env.VALHALLA_ROUTE_URL || DEFAULT_ROUTE_URL;
  const key = process.env.VALHALLA_API_KEY;
  if (!key) return url;
  return `${url}${url.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(key)}`;
}

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
  const body = {
    locations: points.map((p) => ({ lat: p.lat, lon: p.lng })),
    costing: "auto",
    costing_options: { auto: { use_highways: useHighways } },
    directions_options: { units: "kilometers" },
  };
  let res: Response;
  try {
    res = await fetch(routeEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
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
