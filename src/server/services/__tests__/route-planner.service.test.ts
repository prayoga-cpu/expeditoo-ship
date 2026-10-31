import { afterEach, describe, expect, it, vi } from "vitest";

import { routeEndpoint, routePlannerService } from "../route-planner.service";
import { routePlanSchema } from "@/server/dto/route-plan.dto";

/** The driver's route planner — client_feedback_2026_10_29_spec.md §N8. */

const trip = (km: number, seconds: number) => ({
  ok: true,
  status: 200,
  json: async () => ({
    trip: { summary: { length: km, time: seconds }, legs: [{ shape: "_p~iF~ps|U_ulLnnqC" }] },
  }),
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const points = [
  { lat: 48.85, lng: 2.35 },
  { lat: 45.76, lng: 4.84 },
];

describe("routePlannerService.plan", () => {
  it("asks for the same trip twice, with and without motorways", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(trip(465.83, 17_849)).mockResolvedValueOnce(trip(497.91, 37_032));
    vi.stubGlobal("fetch", fetchMock);

    const plan = await routePlannerService.plan({ userId: "d1" }, { points });

    const asked = fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body));
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({ "User-Agent": expect.stringContaining("Expeditoo") }),
    });
    expect(asked.map((b) => b.costing_options.auto.use_highways).sort()).toEqual([0, 1]);
    expect(asked[0].locations).toEqual([
      { lat: 48.85, lon: 2.35 },
      { lat: 45.76, lon: 4.84 },
    ]);
    expect(plan.withMotorway).toMatchObject({ distanceKm: 465.8, durationMinutes: 297 });
    expect(plan.withoutMotorway).toMatchObject({ distanceKm: 497.9, durationMinutes: 617 });
    expect(plan.withMotorway.line.length).toBeGreaterThan(0);
  });

  it("says when no road joins the points", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: "No path could be found" }) }));
    await expect(routePlannerService.plan({ userId: "d1" }, { points })).rejects.toMatchObject({ code: "NO_ROUTE", status: 422 });
  });

  it("says when the router cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    await expect(routePlannerService.plan({ userId: "d1" }, { points })).rejects.toMatchObject({ code: "ROUTER_UNREACHABLE", status: 502 });
  });
});

describe("routeEndpoint", () => {
  it("defaults to the public FOSSGIS router", () => {
    vi.stubEnv("VALHALLA_ROUTE_URL", "");
    vi.stubEnv("VALHALLA_API_KEY", "");
    expect(routeEndpoint()).toBe("https://valhalla1.openstreetmap.de/route");
  });

  it("takes a hosted router and its key, Stadia's way", () => {
    vi.stubEnv("VALHALLA_ROUTE_URL", "https://api-eu.stadiamaps.com/route/v1");
    vi.stubEnv("VALHALLA_API_KEY", "k3y/with+chars");
    expect(routeEndpoint()).toBe("https://api-eu.stadiamaps.com/route/v1?api_key=k3y%2Fwith%2Bchars");
  });
});

describe("routePlanSchema", () => {
  it("takes two to twenty-five points", () => {
    expect(() => routePlanSchema.parse({ points: [points[0]] })).toThrow();
    expect(() => routePlanSchema.parse({ points: Array(26).fill(points[0]) })).toThrow();
    expect(routePlanSchema.parse({ points }).points).toHaveLength(2);
  });
});
