import { describe, expect, it } from "vitest";

import {
  MIN_BIDDING_WINDOW_MS,
  earliestPickupFor,
  publicationProblem,
} from "../listing-window";

/**
 * The publication rule `createListing` enforces, written once so the `/create`
 * form can say it before the round trip (publication_timing_spec.md §1).
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const NOW = new Date(2030, 0, 2, 13, 47);
const later = (ms: number, from = NOW) => new Date(from.getTime() + ms);

describe("publicationProblem", () => {
  it("calls a pickup that has started already past", () => {
    expect(publicationProblem(later(-HOUR), NOW, NOW)).toBe("PICKUP_IN_PAST");
    expect(publicationProblem(NOW, NOW, NOW)).toBe("PICKUP_IN_PAST");
  });

  it("calls a pickup inside the 30-minute minimum too soon", () => {
    expect(publicationProblem(later(20 * MINUTE), NOW, NOW)).toBe("PICKUP_TOO_SOON");
  });

  it("accepts a pickup just past the minimum", () => {
    expect(publicationProblem(later(31 * MINUTE), NOW, NOW)).toBeNull();
  });

  it("accepts a pickup with the full six-hour lead", () => {
    expect(publicationProblem(later(24 * HOUR), NOW, NOW)).toBeNull();
  });

  it("measures from a scheduled publication, not from now", () => {
    // Hours away now, but only twenty minutes after it would go live.
    const publishAt = later(5 * HOUR);
    expect(publicationProblem(later(20 * MINUTE, publishAt), publishAt, NOW)).toBe(
      "PICKUP_TOO_SOON"
    );
  });
});

describe("earliestPickupFor", () => {
  it("is the publication moment plus the minimum bidding window", () => {
    expect(earliestPickupFor(NOW).getTime() - NOW.getTime()).toBe(
      MIN_BIDDING_WINDOW_MS
    );
  });
});
