import { describe, expect, it } from "vitest";

import {
  HEAVY_BRACKET_ID,
  SIZE_PRESET_DIMENSIONS,
  SIZE_PRESET_IDS,
  WEIGHT_BRACKET_IDS,
  WEIGHT_BRACKET_MAX_KG,
  resolveDimensions,
  resolveWeightKg,
} from "../cargo";

/**
 * A bracket is only ever an input affordance: the API still receives one number
 * for weight and three for size. These tests hold the resolution honest, and in
 * particular hold it pointing **upward** — `TakeJobPanel` offers a job to a
 * vehicle when `maxWeightKg >= job.weightKg`, so a bracket that resolved to its
 * floor would put a 90 kg load in a van rated for 50.
 */
describe("weight brackets", () => {
  it("gives every bracket a ceiling, except the one that asks", () => {
    for (const id of WEIGHT_BRACKET_IDS) {
      const ceiling = WEIGHT_BRACKET_MAX_KG[id];
      if (id === HEAVY_BRACKET_ID) expect(ceiling).toBeNull();
      else expect(ceiling).toBeGreaterThan(0);
    }
  });

  it("resolves each bracket to its ceiling", () => {
    expect(resolveWeightKg("upTo5", undefined)).toBe(5);
    expect(resolveWeightKg("upTo30", undefined)).toBe(30);
    expect(resolveWeightKg("upTo100", undefined)).toBe(100);
    expect(resolveWeightKg("upTo500", undefined)).toBe(500);
    expect(resolveWeightKg("upTo1000", undefined)).toBe(1000);
  });

  it("climbs, never falls: each ceiling is above the one before it", () => {
    const ceilings: (number | null)[] = WEIGHT_BRACKET_IDS.map(
      (id) => WEIGHT_BRACKET_MAX_KG[id]
    );
    const stated = ceilings.filter((kg) => kg !== null);

    expect(stated).toEqual([...stated].sort((a, b) => a - b));
  });

  it("takes the typed figure for the freight bracket", () => {
    expect(resolveWeightKg(HEAVY_BRACKET_ID, 12_000)).toBe(12_000);
  });

  it("ignores a figure left behind by a change of mind", () => {
    // Typed under "over 1 t", then a lighter bracket picked. The ceiling wins.
    expect(resolveWeightKg("upTo30", 12_000)).toBe(30);
  });

  it("has nothing to resolve when the freight figure is missing", () => {
    // The schema rejects this before it can be sent; the resolver simply must
    // not invent a number.
    expect(resolveWeightKg(HEAVY_BRACKET_ID, undefined)).toBeUndefined();
  });
});

describe("size presets", () => {
  it("gives every preset three positive dimensions", () => {
    for (const id of SIZE_PRESET_IDS) {
      const { lengthCm, widthCm, heightCm } = SIZE_PRESET_DIMENSIONS[id];
      expect(lengthCm).toBeGreaterThan(0);
      expect(widthCm).toBeGreaterThan(0);
      expect(heightCm).toBeGreaterThan(0);
    }
  });

  it("grows with each step up the ladder", () => {
    const volume = (id: (typeof SIZE_PRESET_IDS)[number]) => {
      const { lengthCm, widthCm, heightCm } = SIZE_PRESET_DIMENSIONS[id];
      return lengthCm * widthCm * heightCm;
    };
    const volumes = SIZE_PRESET_IDS.map(volume);

    expect(volumes).toEqual([...volumes].sort((a, b) => a - b));
  });

  it("resolves a preset to its dimensions", () => {
    expect(resolveDimensions("preset", "l", {})).toEqual(
      SIZE_PRESET_DIMENSIONS.l
    );
  });

  it("sends nothing when no preset is chosen", () => {
    expect(resolveDimensions("preset", undefined, {})).toEqual({});
  });

  it("takes the typed values in exact mode", () => {
    expect(
      resolveDimensions("exact", undefined, {
        lengthCm: 120,
        widthCm: 80,
        heightCm: 70,
      })
    ).toEqual({ lengthCm: 120, widthCm: 80, heightCm: 70 });
  });

  it("never mixes a preset with a typed number", () => {
    // Both modes were visited. Only the active one is read, in either
    // direction, so switching back and forth cannot produce a hybrid.
    expect(
      resolveDimensions("exact", "xxl", {
        lengthCm: 120,
        widthCm: 80,
        heightCm: 70,
      })
    ).toEqual({ lengthCm: 120, widthCm: 80, heightCm: 70 });

    expect(
      resolveDimensions("preset", "s", {
        lengthCm: 120,
        widthCm: 80,
        heightCm: 70,
      })
    ).toEqual(SIZE_PRESET_DIMENSIONS.s);
  });
});
