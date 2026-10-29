import { describe, expect, it } from "vitest";

import { suggestedRange, suggestionRequest } from "../price-suggestion";

/** client_feedback_2026_10_29_spec.md §B6 — « Prix conseillé ». */
const base = {
  pickup: { lat: 48.85, lng: 2.35 },
  dropoff: { lat: 45.76, lng: 4.84 },
  weightBracket: "upTo30" as const,
  sizeMode: "preset" as const,
  sizePreset: "m" as const,
};

describe("suggestionRequest", () => {
  it("asks the engine with the bracket's ceiling and the preset's size", () => {
    expect(suggestionRequest(base)).toEqual({
      origin: { lat: 48.85, lng: 2.35 },
      destination: { lat: 45.76, lng: 4.84 },
      package: { length: 80, width: 60, height: 50, weight: 30 },
      speed: "STANDARD",
    });
  });

  it("reads typed numbers as the box shows them, comma and all", () => {
    const req = suggestionRequest({
      ...base,
      sizeMode: "exact",
      lengthCm: "120,5",
      widthCm: "40",
      heightCm: "35",
    });
    expect(req?.package).toMatchObject({ length: 120.5, width: 40, height: 35 });
  });

  it("asks nothing without both pins, a weight and a size", () => {
    expect(suggestionRequest({ ...base, pickup: {} })).toBeNull();
    expect(suggestionRequest({ ...base, weightBracket: undefined })).toBeNull();
    expect(suggestionRequest({ ...base, sizePreset: undefined })).toBeNull();
  });

  it("asks nothing the parcel engine cannot price honestly", () => {
    expect(suggestionRequest({ ...base, weightBracket: "upTo500" })).toBeNull();
    expect(
      suggestionRequest({ ...base, sizeMode: "exact", lengthCm: "350", widthCm: "50", heightCm: "50" })
    ).toBeNull();
  });
});

describe("suggestedRange", () => {
  it("spreads the figure 15 % either way, to the nearest 5 €", () => {
    expect(suggestedRange(100)).toEqual({ lowCents: 8_500, highCents: 11_500 });
    expect(suggestedRange(57.3)).toEqual({ lowCents: 5_000, highCents: 6_500 });
  });

  it("never suggests below 5 €", () => {
    expect(suggestedRange(2)).toEqual({ lowCents: 500, highCents: 500 });
  });
});
