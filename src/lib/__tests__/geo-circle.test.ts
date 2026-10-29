import { describe, expect, it } from "vitest";

import { circleRing, ringBounds } from "../geo-circle";

/** client_feedback_2026_10_29_spec.md §D2 — the « Autour de » area. */
const KM_PER_DEG_LAT = 111.195;

describe("circleRing", () => {
  const paris = { lat: 48.8566, lng: 2.3522 };

  it("closes on itself", () => {
    const ring = circleRing(paris, 50, 32);
    expect(ring).toHaveLength(33);
    expect(ring[0][0]).toBeCloseTo(ring[32][0], 9);
    expect(ring[0][1]).toBeCloseTo(ring[32][1], 9);
  });

  it("reaches the radius due north", () => {
    const [, northLat] = circleRing(paris, 50, 4)[0];
    expect((northLat - paris.lat) * KM_PER_DEG_LAT).toBeCloseTo(50, 0);
  });

  it("is wider in degrees of longitude than of latitude, away from the equator", () => {
    const [[west, south], [east, north]] = ringBounds(circleRing(paris, 50));
    expect(east - west).toBeGreaterThan(north - south);
  });
});
