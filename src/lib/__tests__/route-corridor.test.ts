import { describe, it, expect } from "vitest";
import {
  corridorFrame,
  KM_PER_DEGREE,
  isOnCorridor,
  positionOnCorridor,
} from "@/lib/route-corridor";

// Bordeaux → Paris, the corridor the spec argues about.
const BORDEAUX = { lat: 44.84, lng: -0.58 };
const PARIS = { lat: 48.86, lng: 2.35 };
const frame = corridorFrame(BORDEAUX, PARIS);

describe("positionOnCorridor", () => {
  it("puts the departure at the start and the arrival at the end", () => {
    expect(positionOnCorridor(frame, BORDEAUX).progress).toBeCloseTo(0, 5);
    expect(positionOnCorridor(frame, PARIS).progress).toBeCloseTo(1, 5);
    expect(positionOnCorridor(frame, BORDEAUX).detourKm).toBeCloseTo(0, 5);
  });

  it("measures no detour for a point sitting on the line", () => {
    const midpoint = {
      lat: (BORDEAUX.lat + PARIS.lat) / 2,
      lng: (BORDEAUX.lng + PARIS.lng) / 2,
    };

    const { detourKm, progress } = positionOnCorridor(frame, midpoint);

    expect(detourKm).toBeCloseTo(0, 3);
    expect(progress).toBeCloseTo(0.5, 3);
  });

  it("measures the real offset for a point beside the line", () => {
    // A degree of latitude is 111.32 km; step off the midpoint by a tenth of
    // one, roughly perpendicular to a corridor that runs mostly north.
    const midLat = (BORDEAUX.lat + PARIS.lat) / 2;
    const beside = {
      lat: midLat,
      lng: (BORDEAUX.lng + PARIS.lng) / 2 + 1,
    };

    const { detourKm } = positionOnCorridor(frame, beside);

    // One degree of longitude at this latitude, minus the part that runs along
    // the corridor rather than across it.
    expect(detourKm).toBeGreaterThan(50);
    expect(detourKm).toBeLessThan(80);
  });

  it("clamps a point beyond the arrival back onto the segment", () => {
    // Lille, well past Paris on the same heading.
    const beyond = { lat: 50.63, lng: 3.06 };
    const { progress, detourKm } = positionOnCorridor(frame, beyond);

    expect(progress).toBe(1);

    // Measured from Paris, not from an imaginary extension of the corridor.
    // Computed inside this frame: a frame built on Paris alone would scale
    // longitude at a different latitude and disagree by a few hundred metres.
    const expected = Math.hypot(
      (beyond.lng - PARIS.lng) * frame.lngScale,
      (beyond.lat - PARIS.lat) * KM_PER_DEGREE
    );

    expect(detourKm).toBeCloseTo(expected, 6);
  });

  it("falls back to distance from the departure when the ends coincide", () => {
    // The limit of point-to-segment distance as the arrival approaches the
    // departure, so a driver typing one city into both fields gets a radius
    // search rather than a division by zero.
    const degenerate = corridorFrame(BORDEAUX, BORDEAUX);
    const { detourKm, progress } = positionOnCorridor(degenerate, PARIS);

    expect(progress).toBe(0);
    expect(Number.isFinite(detourKm)).toBe(true);
    // Bordeaux to Paris is roughly 500 km as the crow flies.
    expect(detourKm).toBeGreaterThan(450);
    expect(detourKm).toBeLessThan(560);
  });
});

describe("isOnCorridor", () => {
  // Angoulême and Orléans both sit on the Bordeaux → Paris axis.
  const ANGOULEME = { lat: 45.65, lng: 0.16 };
  const ORLEANS = { lat: 47.9, lng: 1.9 };
  // Well off it.
  const LYON = { lat: 45.76, lng: 4.84 };

  it("accepts a job that lies along the way", () => {
    expect(isOnCorridor(frame, ANGOULEME, ORLEANS, 75)).toBe(true);
  });

  it("rejects the same job travelling the other way", () => {
    // The whole point of a trajet: a driver heading north is not offered a
    // load heading south.
    expect(isOnCorridor(frame, ORLEANS, ANGOULEME, 75)).toBe(false);
  });

  it("rejects a job whose far end leaves the corridor", () => {
    expect(isOnCorridor(frame, ANGOULEME, LYON, 75)).toBe(false);
  });

  it("widens with the radius", () => {
    const nearlyOn = { lat: 46.58, lng: 0.34 }; // Poitiers
    const justOff = { lat: 46.32, lng: -0.46 }; // Niort, further west

    expect(isOnCorridor(frame, justOff, nearlyOn, 25)).toBe(false);
    expect(isOnCorridor(frame, justOff, nearlyOn, 100)).toBe(true);
  });
});
