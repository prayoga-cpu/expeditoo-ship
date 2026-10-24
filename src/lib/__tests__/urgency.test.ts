import { describe, expect, it } from "vitest";

import { collectBy, isUrgent, URGENT_WITHIN_HOURS } from "../urgency";

/** client_feedback_2026_10_21_spec.md §B5 */
const NOW = new Date("2026-10-24T12:00:00.000Z");
const inHours = (h: number) => new Date(NOW.getTime() + h * 3_600_000).toISOString();

const job = (over: Partial<Parameters<typeof isUrgent>[0]> = {}) => ({
  status: "open",
  pickupFrom: inHours(24),
  pickupUntil: inHours(30),
  isFlexible: false,
  ...over,
});

describe("isUrgent", () => {
  it("is urgent when a fixed pickup starts within 48 hours", () => {
    expect(isUrgent(job(), NOW)).toBe(true);
    expect(isUrgent(job({ pickupFrom: inHours(URGENT_WITHIN_HOURS) }), NOW)).toBe(true);
  });

  it("is not urgent beyond 48 hours", () => {
    expect(isUrgent(job({ pickupFrom: inHours(49) }), NOW)).toBe(false);
  });

  it("is not urgent once the moment has passed", () => {
    expect(isUrgent(job({ pickupFrom: inHours(-1) }), NOW)).toBe(false);
  });

  it("reads a flexible request by the end of its window, not its start", () => {
    // Open from yesterday to in three weeks: not urgent today.
    const wide = job({ isFlexible: true, pickupFrom: inHours(-24), pickupUntil: inHours(21 * 24) });
    expect(isUrgent(wide, NOW)).toBe(false);
    expect(collectBy(wide).toISOString()).toBe(inHours(21 * 24));
    // The same window, two days before it closes: urgent.
    expect(isUrgent(job({ isFlexible: true, pickupFrom: inHours(-24), pickupUntil: inHours(40) }), NOW)).toBe(true);
  });

  it.each(["draft", "scheduled", "awarded", "in_progress", "completed", "cancelled", "expired"])(
    "is never urgent once %s — only a request still without a driver is",
    (status) => {
      expect(isUrgent(job({ status }), NOW)).toBe(false);
    }
  );
});
