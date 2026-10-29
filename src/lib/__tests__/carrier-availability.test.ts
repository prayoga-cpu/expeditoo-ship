import { describe, expect, it } from "vitest";

import { driverStanding, isAbsent, mayTakeWork } from "../carrier-availability";

/** client_feedback_2026_10_29_spec.md §REQ-02 */
const NOW = new Date("2026-10-29T12:00:00.000Z");
const hours = (h: number) => new Date(NOW.getTime() + h * 3_600_000);
const approved = (over: Record<string, unknown> = {}) => ({ status: "approved", ...over });

describe("isAbsent", () => {
  it("is not absent without an absence", () => {
    expect(isAbsent(approved(), NOW)).toBe(false);
  });

  it("is absent with no end date until someone ends it", () => {
    expect(isAbsent(approved({ absentSince: hours(-48) }), NOW)).toBe(true);
  });

  it("is absent until the return date, and back by itself after it", () => {
    expect(isAbsent(approved({ absentSince: hours(-1), absentUntil: hours(24) }), NOW)).toBe(true);
    expect(isAbsent(approved({ absentSince: hours(-48), absentUntil: hours(-1) }), NOW)).toBe(false);
    expect(isAbsent(approved({ absentSince: hours(-48), absentUntil: NOW }), NOW)).toBe(false);
  });
});

describe("mayTakeWork", () => {
  it("lets an active driver take work", () => {
    expect(mayTakeWork(approved(), NOW)).toBe(true);
  });

  it("refuses an absent driver, and lets them back once the date passes", () => {
    expect(mayTakeWork(approved({ absentSince: hours(-1) }), NOW)).toBe(false);
    expect(mayTakeWork(approved({ absentSince: hours(-48), absentUntil: hours(-1) }), NOW)).toBe(true);
  });

  it.each(["draft", "submitted", "under_review", "rejected", "suspended", "deregistered"])(
    "refuses a %s account",
    (status) => {
      expect(mayTakeWork({ status }, NOW)).toBe(false);
    }
  );

  it("refuses nobody at all", () => {
    expect(mayTakeWork(null, NOW)).toBe(false);
  });
});

describe("driverStanding", () => {
  it("reads the four words of the field test", () => {
    expect(driverStanding(approved(), NOW)).toBe("active");
    expect(driverStanding(approved({ absentSince: hours(-1) }), NOW)).toBe("absent");
    expect(driverStanding({ status: "suspended" }, NOW)).toBe("suspended");
    expect(driverStanding({ status: "deregistered" }, NOW)).toBe("deregistered");
    expect(driverStanding({ status: "submitted" }, NOW)).toBe("applying");
  });
});
