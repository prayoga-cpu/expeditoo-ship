import { describe, expect, it } from "vitest";
import { COORDINATE_SCALE, roundCoordinate } from "../listing-coordinates";

/**
 * listing_privacy_spec.md §1 — about a kilometre out for the public. The SQL
 * in `listings.dal.ts` transcribes this function; its rendered form is
 * asserted in `listings-browse.dal.test.ts`.
 */
/** The card the client receives: JSON, where -0 and +0 are both « 0 ». */
const onTheWire = (value: number) => JSON.stringify(value);
const oldCard = (value: number) => onTheWire(Math.round(value * 100) / 100);

describe("roundCoordinate", () => {
  it("keeps two decimals", () => {
    expect(COORDINATE_SCALE).toBe(100);
    expect(roundCoordinate(45.764043)).toBe(45.76);
    expect(roundCoordinate(5.36978)).toBe(5.37);
    expect(roundCoordinate(-1.553621)).toBe(-1.55);
  });

  it("rounds every pin to the point the card always showed", () => {
    // The card used `Math.round(v * 100) / 100` before the formula moved here
    // so the SQL could share it. A sweep across mainland France, west of
    // Greenwich included, proves no card moved.
    let seed = 42;
    const next = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed / 2_147_483_648;
    };
    for (let i = 0; i < 20_000; i++) {
      const lat = 41 + next() * 10.5;
      const lng = -5.5 + next() * 15.5;
      expect(onTheWire(roundCoordinate(lat))).toBe(oldCard(lat));
      expect(onTheWire(roundCoordinate(lng))).toBe(oldCard(lng));
    }
  });

  it("agrees with the old formula on halves, on both sides of zero", () => {
    for (const value of [2.345, 48.855, -1.235, -0.004, -0.005, 0.005, -4.485]) {
      expect(onTheWire(roundCoordinate(value))).toBe(oldCard(value));
    }
  });
});
