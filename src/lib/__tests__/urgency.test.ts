import { describe, expect, it } from "vitest";

import { collectBy, isImmediate, isUrgent, URGENT_WITHIN_HOURS } from "../urgency";

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

describe("isUrgent past the bidding deadline", () => {
  it("is not urgent once bidding has closed, even before the sweep runs", () => {
    expect(isUrgent(job({ expiresAt: inHours(-1) }), NOW)).toBe(false);
    expect(isUrgent(job({ expiresAt: inHours(6) }), NOW)).toBe(true);
  });
});

/** client_feedback_2026_10_29_spec.md §B5 */
describe("isImmediate", () => {
  const flexible = (over: Partial<Parameters<typeof isImmediate>[0]> = {}) =>
    job({ isFlexible: true, pickupFrom: inHours(-24), pickupUntil: inHours(21 * 24), ...over });

  it("is immediate while the pickup window is already open", () => {
    expect(isImmediate(flexible(), NOW)).toBe(true);
  });

  it("is immediate from the very first minute of the window", () => {
    expect(isImmediate(flexible({ pickupFrom: NOW.toISOString() }), NOW)).toBe(true);
  });

  it("is not immediate before the window opens", () => {
    expect(isImmediate(job(), NOW)).toBe(false);
  });

  it("is not immediate once the window has closed", () => {
    expect(isImmediate(flexible({ pickupUntil: NOW.toISOString() }), NOW)).toBe(false);
  });

  it("is not immediate past the bidding deadline", () => {
    expect(isImmediate(flexible({ expiresAt: inHours(-1) }), NOW)).toBe(false);
  });

  it("can be immediate and urgent at once", () => {
    const closing = flexible({ pickupUntil: inHours(40) });
    expect(isImmediate(closing, NOW)).toBe(true);
    expect(isUrgent(closing, NOW)).toBe(true);
  });

  it.each(["draft", "scheduled", "awarded", "in_progress", "completed", "cancelled", "expired"])(
    "is never immediate once %s",
    (status) => {
      expect(isImmediate(flexible({ status }), NOW)).toBe(false);
    }
  );
});
