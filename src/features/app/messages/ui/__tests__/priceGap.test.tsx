import { describe, expect, it } from "vitest";

import { priceGap } from "../ThreadOfferBubble";

/** client_feedback_2026_10_21_spec.md §B6 */
describe("priceGap", () => {
  it("is negative below the budget", () => {
    expect(priceGap(8_500, 10_000)).toBe(-15);
  });

  it("is positive above it", () => {
    expect(priceGap(11_000, 10_000)).toBe(10);
  });

  it("is zero at the budget", () => {
    expect(priceGap(10_000, 10_000)).toBe(0);
  });

  it.each([null, undefined, 0])("is null with no budget to compare (%s)", (budget) => {
    expect(priceGap(10_000, budget)).toBeNull();
  });
});
