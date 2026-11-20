import { describe, expect, it } from "vitest";

import { jobDates, jobLine, routeOf } from "../job-summary";

// Client feedback 2026-11, #25/#31/#34: a conversation names its job.
const NOW = new Date("2026-11-10T12:00:00");

describe("routeOf", () => {
  it("joins the two towns", () => {
    expect(routeOf("Paris", "Lyon")).toBe("Paris → Lyon");
  });

  it("says nothing with one end missing", () => {
    expect(routeOf("Paris", null)).toBeNull();
    expect(routeOf(undefined, "Lyon")).toBeNull();
  });
});

describe("jobDates", () => {
  it("writes the pickup day, then the delivery day", () => {
    expect(
      jobDates("2026-11-20T09:00:00", "2026-11-22T18:00:00", "fr", NOW)
    ).toBe("20 nov. – 22 nov.");
  });

  it("writes one date when both fall on the same day", () => {
    expect(
      jobDates("2026-11-20T09:00:00", "2026-11-20T18:00:00", "fr", NOW)
    ).toBe("20 nov.");
  });

  it("follows the reader's locale", () => {
    expect(
      jobDates("2026-11-20T09:00:00", "2026-11-22T18:00:00", "en", NOW)
    ).toBe("Nov 20 – Nov 22");
  });

  it("names the year of a job that is not this year's", () => {
    expect(
      jobDates("2025-11-20T09:00:00", "2025-11-20T18:00:00", "fr", NOW)
    ).toContain("2025");
  });

  it("falls back to the pickup day alone without a delivery date", () => {
    expect(jobDates("2026-11-20T09:00:00", undefined, "fr", NOW)).toBe("20 nov.");
  });

  it("says nothing without a pickup date, or with one that is not a date", () => {
    expect(jobDates(undefined, "2026-11-22T18:00:00", "fr", NOW)).toBeNull();
    expect(jobDates("soon", null, "fr", NOW)).toBeNull();
  });
});

describe("jobLine", () => {
  it("joins the route and the dates", () => {
    expect(jobLine("Paris → Lyon", "20 nov. – 22 nov.")).toBe(
      "Paris → Lyon · 20 nov. – 22 nov."
    );
  });

  it("keeps whichever half is known, and is null with neither", () => {
    expect(jobLine("Paris → Lyon", undefined)).toBe("Paris → Lyon");
    expect(jobLine(null, "20 nov.")).toBe("20 nov.");
    expect(jobLine(null, null)).toBeNull();
  });
});
