import { describe, it, expect } from "vitest";
import { availabilityIntervals } from "@/lib/availability-window";

// Paris in summer is UTC+2, so getTimezoneOffset() reports -120.
const PARIS_SUMMER = -120;

const hoursUtc = (interval: { start: Date; end: Date }) => [
  interval.start.toISOString(),
  interval.end.toISOString(),
];

describe("availabilityIntervals", () => {
  it("puts a slot at the driver's hour, not the server's", () => {
    // Production runs TZ=UTC; without the offset a French driver's 06:00
    // would be filtered as 08:00.
    const [morning] = availabilityIntervals(
      ["2026-09-02"],
      ["morning"],
      PARIS_SUMMER
    );

    expect(hoursUtc(morning)).toEqual([
      "2026-09-02T04:00:00.000Z",
      "2026-09-02T10:00:00.000Z",
    ]);
  });

  it("treats a zero offset as UTC", () => {
    const [morning] = availabilityIntervals(["2026-09-02"], ["morning"], 0);

    expect(hoursUtc(morning)).toEqual([
      "2026-09-02T06:00:00.000Z",
      "2026-09-02T12:00:00.000Z",
    ]);
  });

  it("merges adjacent slots into one interval", () => {
    const intervals = availabilityIntervals(
      ["2026-09-02"],
      ["morning", "afternoon"],
      0
    );

    expect(intervals).toHaveLength(1);
    expect(hoursUtc(intervals[0])).toEqual([
      "2026-09-02T06:00:00.000Z",
      "2026-09-02T18:00:00.000Z",
    ]);
  });

  it("collapses all three slots into a single 06:00–22:00 window", () => {
    const intervals = availabilityIntervals(
      ["2026-09-02"],
      ["morning", "afternoon", "evening"],
      0
    );

    expect(intervals).toHaveLength(1);
    expect(hoursUtc(intervals[0])).toEqual([
      "2026-09-02T06:00:00.000Z",
      "2026-09-02T22:00:00.000Z",
    ]);
  });

  it("keeps a gap between slots that do not touch", () => {
    const intervals = availabilityIntervals(
      ["2026-09-02"],
      ["morning", "evening"],
      0
    );

    expect(intervals).toHaveLength(2);
    expect(hoursUtc(intervals[1])).toEqual([
      "2026-09-02T18:00:00.000Z",
      "2026-09-02T22:00:00.000Z",
    ]);
  });

  it("covers the whole day when no slot is chosen", () => {
    const [whole] = availabilityIntervals(["2026-09-02"], [], 0);

    expect(hoursUtc(whole)).toEqual([
      "2026-09-02T00:00:00.000Z",
      "2026-09-03T00:00:00.000Z",
    ]);
  });

  it("expands every chosen day", () => {
    const intervals = availabilityIntervals(
      ["2026-09-02", "2026-09-05"],
      ["morning", "evening"],
      0
    );

    expect(intervals).toHaveLength(4);
  });

  it("filters nothing when no day is chosen", () => {
    // A time of day with no date is not a constraint.
    expect(availabilityIntervals([], ["morning"], 0)).toEqual([]);
  });

  it("orders each interval start before its end", () => {
    for (const interval of availabilityIntervals(
      ["2026-09-02"],
      ["morning", "afternoon", "evening"],
      PARIS_SUMMER
    )) {
      expect(interval.start.getTime()).toBeLessThan(interval.end.getTime());
    }
  });
});
