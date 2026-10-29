import { describe, expect, it } from "vitest";

import { durationLabel, moveStop, outOfOrder, planPoints, type PlanStop } from "../plan-stops";

/** client_feedback_2026_10_29_spec.md §N8 */
const p = (lat: number) => ({ lat, lng: 2 });
const pickup = (runId: string): PlanStop => ({ key: `${runId}-p`, kind: "pickup", runId, label: runId, point: p(1) });
const dropoff = (runId: string): PlanStop => ({ key: `${runId}-d`, kind: "dropoff", runId, label: runId, point: p(2) });

describe("moveStop", () => {
  it("swaps a stop with its neighbour", () => {
    const stops = [pickup("a"), dropoff("a"), pickup("b")];
    expect(moveStop(stops, 2, -1).map((s) => s.key)).toEqual(["a-p", "b-p", "a-d"]);
  });

  it("changes nothing past either end", () => {
    const stops = [pickup("a"), dropoff("a")];
    expect(moveStop(stops, 0, -1)).toBe(stops);
    expect(moveStop(stops, 1, 1)).toBe(stops);
  });
});

describe("outOfOrder", () => {
  it("names a run delivered before it is collected", () => {
    expect(outOfOrder([dropoff("a"), pickup("a")])).toEqual(["a"]);
    expect(outOfOrder([pickup("a"), pickup("b"), dropoff("a"), dropoff("b")])).toEqual([]);
  });

  it("never faults a run already on board, which has no pickup stop", () => {
    expect(outOfOrder([dropoff("a")])).toEqual([]);
  });
});

describe("planPoints", () => {
  it("is departure, stops, arrival — any end may be missing", () => {
    expect(planPoints(p(0), [pickup("a")], p(9))).toEqual([p(0), p(1), p(9)]);
    expect(planPoints(null, [pickup("a"), dropoff("a")], null)).toEqual([p(1), p(2)]);
  });
});

describe("durationLabel", () => {
  it.each([
    [47, "47 min"],
    [60, "1 h"],
    [343, "5 h 43"],
    [661, "11 h 01"],
  ])("%i minutes read %s", (minutes, label) => {
    expect(durationLabel(minutes)).toBe(label);
  });
});
