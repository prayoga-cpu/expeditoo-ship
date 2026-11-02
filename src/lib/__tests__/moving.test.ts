import { describe, expect, it } from "vitest";

import { movingVolumeM3, movingWeightKg } from "../moving";

/** client_feedback_2026_10_31_spec.md §0 D — the weight a move is stored with. */
describe("a move's size", () => {
  it("reads a home's volume as half its surface", () => {
    expect(movingVolumeM3({ surfaceM2: 65 })).toBe(32.5);
  });

  it("prefers the volume when it was given", () => {
    expect(movingVolumeM3({ surfaceM2: 65, volumeM3: 20 })).toBe(20);
  });

  it("weighs 150 kg a cubic metre, whole kilograms", () => {
    expect(movingWeightKg({ surfaceM2: 65 })).toBe(4875);
    expect(movingWeightKg({ volumeM3: 0.5 })).toBe(75);
  });

  it("stops at a lorry's 44 t", () => {
    expect(movingWeightKg({ volumeM3: 500 })).toBe(44_000);
  });

  it("has no weight without a size", () => {
    expect(movingWeightKg({})).toBeNull();
    expect(movingWeightKg({ surfaceM2: null, volumeM3: null })).toBeNull();
  });
});
