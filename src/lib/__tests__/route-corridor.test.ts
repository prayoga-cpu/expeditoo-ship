import { describe, it, expect } from "vitest";
import {
  corridorPath,
  isOnPath,
  KM_PER_DEGREE,
  positionOnPath,
  positionOnSegment,
} from "@/lib/route-corridor";

// The corridor the spec argues about.
const BORDEAUX = { lat: 44.84, lng: -0.58 };
const PARIS = { lat: 48.86, lng: 2.35 };
// On the Bordeaux → Paris axis.
const ANGOULEME = { lat: 45.65, lng: 0.16 };
const ORLEANS = { lat: 47.9, lng: 1.9 };
// Well off it.
const LYON = { lat: 45.76, lng: 4.84 };
const TOULOUSE = { lat: 43.6, lng: 1.44 };

const path = corridorPath([BORDEAUX, PARIS]);

describe("positionOnPath", () => {
  it("puts the departure at the start and the arrival at the end", () => {
    expect(positionOnPath(path, BORDEAUX).progressKm).toBeCloseTo(0, 5);
    expect(positionOnPath(path, BORDEAUX).detourKm).toBeCloseTo(0, 5);
    expect(positionOnPath(path, PARIS).progressKm).toBeCloseTo(path.totalKm, 5);
  });

  it("measures no detour for a point sitting on the line", () => {
    const midpoint = {
      lat: (BORDEAUX.lat + PARIS.lat) / 2,
      lng: (BORDEAUX.lng + PARIS.lng) / 2,
    };

    const { detourKm, progressKm } = positionOnPath(path, midpoint);

    expect(detourKm).toBeCloseTo(0, 3);
    expect(progressKm).toBeCloseTo(path.totalKm / 2, 3);
  });

  it("measures the real offset for a point beside the line", () => {
    const beside = {
      lat: (BORDEAUX.lat + PARIS.lat) / 2,
      lng: (BORDEAUX.lng + PARIS.lng) / 2 + 1,
    };

    const { detourKm } = positionOnPath(path, beside);

    expect(detourKm).toBeGreaterThan(50);
    expect(detourKm).toBeLessThan(80);
  });

  it("clamps a point beyond the arrival back onto the path", () => {
    // Lille, well past Paris on the same heading.
    const beyond = { lat: 50.63, lng: 3.06 };
    const { progressKm, detourKm } = positionOnPath(path, beyond);

    expect(progressKm).toBeCloseTo(path.totalKm, 5);

    // Measured from Paris, not from an imaginary extension of the corridor.
    const expected = Math.hypot(
      (beyond.lng - PARIS.lng) * path.lngScale,
      (beyond.lat - PARIS.lat) * KM_PER_DEGREE
    );
    expect(detourKm).toBeCloseTo(expected, 6);
  });

  it("falls back to distance from the departure when the ends coincide", () => {
    // The limit of point-to-segment distance as the arrival approaches the
    // departure, so one city typed into both fields is a radius search rather
    // than a division by zero.
    const degenerate = corridorPath([BORDEAUX, BORDEAUX]);
    const { detourKm, progressKm } = positionOnPath(degenerate, PARIS);

    expect(progressKm).toBe(0);
    expect(detourKm).toBeGreaterThan(450);
    expect(detourKm).toBeLessThan(560);
  });

  it("treats a single point as a place, not a direction", () => {
    const single = corridorPath([BORDEAUX]);

    expect(single.segments).toHaveLength(1);
    expect(single.totalKm).toBe(0);
    expect(positionOnPath(single, BORDEAUX).detourKm).toBeCloseTo(0, 5);
  });
});

describe("isOnPath", () => {
  it("accepts a job that lies along the way", () => {
    expect(isOnPath(path, ANGOULEME, ORLEANS, 75)).toBe(true);
  });

  it("rejects the same job travelling the other way", () => {
    // The whole point of a trajet: a driver heading north is not offered a
    // load heading south.
    expect(isOnPath(path, ORLEANS, ANGOULEME, 75)).toBe(false);
  });

  it("rejects a job whose far end leaves the corridor", () => {
    expect(isOnPath(path, ANGOULEME, LYON, 75)).toBe(false);
  });

  it("widens with the radius", () => {
    const poitiers = { lat: 46.58, lng: 0.34 };
    const niort = { lat: 46.32, lng: -0.46 };

    expect(isOnPath(path, niort, poitiers, 25)).toBe(false);
    expect(isOnPath(path, niort, poitiers, 100)).toBe(true);
  });
});

describe("waypoints", () => {
  // Bordeaux → Lyon → Paris: a dog-leg east that the straight corridor misses.
  const viaLyon = corridorPath([BORDEAUX, LYON, PARIS]);

  it("adds up the legs", () => {
    expect(viaLyon.segments).toHaveLength(2);
    expect(viaLyon.segments[1].startKm).toBeCloseTo(
      viaLyon.segments[0].lengthKm,
      6
    );
    expect(viaLyon.totalKm).toBeGreaterThan(path.totalKm);
  });

  it("reaches a job the straight corridor cannot", () => {
    // Lyon → Paris is off the Bordeaux → Paris line, on the étape route.
    expect(isOnPath(path, LYON, PARIS, 75)).toBe(false);
    expect(isOnPath(viaLyon, LYON, PARIS, 75)).toBe(true);
  });

  it("still refuses a load that doubles back through the étape", () => {
    // Orléans sits on the second leg, Lyon at the joint: collecting after the
    // étape and delivering before it is not on the way.
    expect(isOnPath(viaLyon, ORLEANS, LYON, 75)).toBe(false);
  });

  it("measures progress along the whole path, not the nearest leg", () => {
    const atLyon = positionOnPath(viaLyon, LYON);

    expect(atLyon.detourKm).toBeCloseTo(0, 3);
    expect(atLyon.progressKm).toBeCloseTo(viaLyon.segments[0].lengthKm, 3);
  });

  it("answers with the nearest leg, not the first", () => {
    // Toulouse lies beside the Bordeaux leg and far past the Lyon one, so the
    // two legs give genuinely different answers. Measured inside this path's
    // own frame — a
    // frame built on one leg alone scales longitude at a different latitude
    // and disagrees by a few hundred metres.
    const legs = viaLyon.segments.map(
      (segment) =>
        positionOnSegment(segment, TOULOUSE, viaLyon.lngScale).detourKm
    );

    expect(positionOnPath(viaLyon, TOULOUSE).detourKm).toBeCloseTo(
      Math.min(...legs),
      9
    );
    // And the two legs really do disagree, so the assertion above has teeth.
    expect(Math.abs(legs[0] - legs[1])).toBeGreaterThan(50);
  });
});
