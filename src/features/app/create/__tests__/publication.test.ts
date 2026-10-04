import { describe, expect, it } from "vitest";

import { forInput } from "../timing";
import { publicationIssues } from "../publication";

/**
 * Whether the request on screen can be published as it stands
 * (publication_timing_spec.md §3.2). Values arrive as the form holds them —
 * `datetime-local` strings — or as the schema outputs them, Dates.
 */

const NOW = new Date(2030, 0, 2, 13, 47);
const at = (day: number, hour: number, minute = 0) =>
  new Date(2030, 0, day, hour, minute);
const field = (date: Date) => forInput(date.getTime());

describe("publicationIssues — the pickup", () => {
  it("reports a pickup that has already started", () => {
    expect(publicationIssues({ pickupFrom: field(at(2, 9)) }, NOW).pickup).toEqual({
      kind: "inPast",
    });
  });

  it("reports a pickup too soon to bid on, with the earliest that works", () => {
    const issues = publicationIssues({ pickupFrom: field(at(2, 14)) }, NOW);

    expect(issues.pickup).toEqual({ kind: "tooSoon", earliest: at(2, 14, 30) });
    // Never a warning beside an error.
    expect(issues.biddingClosesAt).toBeNull();
  });

  it("warns when carriers would have under six hours to bid", () => {
    const issues = publicationIssues({ pickupFrom: field(at(2, 15)) }, NOW);

    expect(issues.pickup).toBeNull();
    // Inside the six-hour lead: the 30-minute minimum, from now.
    expect(issues.biddingClosesAt).toEqual(at(2, 14, 17));
  });

  it("shows the real deadline in the 6 h – 6 h 30 band", () => {
    // Bidding closes six hours before pickup even when that is minutes away.
    const issues = publicationIssues({ pickupFrom: field(at(2, 20)) }, NOW);

    expect(issues.biddingClosesAt).toEqual(at(2, 14));
  });

  it("says nothing when carriers have the full lead", () => {
    expect(publicationIssues({ pickupFrom: field(at(3, 9)) }, NOW)).toEqual({
      pickup: null,
      schedule: null,
      biddingClosesAt: null,
    });
  });

  it("calls a window still under way too close, not passed", () => {
    // Today's morning, at 11:00: it runs until noon.
    const issues = publicationIssues(
      { pickupFrom: field(at(2, 6)), pickupUntil: field(at(2, 12)) },
      at(2, 11)
    );

    expect(issues.pickup).toEqual({ kind: "tooSoon", earliest: at(2, 12) });
  });

  it("calls a window that has ended passed", () => {
    const issues = publicationIssues(
      { pickupFrom: field(at(2, 6)), pickupUntil: field(at(2, 12)) },
      NOW
    );

    expect(issues.pickup).toEqual({ kind: "inPast" });
  });

  it("reads a Date as the schema outputs it", () => {
    expect(publicationIssues({ pickupFrom: at(2, 9) }, NOW).pickup).toEqual({
      kind: "inPast",
    });
  });

  it("leaves a missing date to the schema", () => {
    expect(publicationIssues({ pickupFrom: "" }, NOW).pickup).toBeNull();
    expect(publicationIssues({}, NOW).pickup).toBeNull();
  });
});

describe("publicationIssues — a schedule", () => {
  const scheduled = (pickupFrom: Date, scheduledPublishAt: unknown) =>
    publicationIssues(
      { pickupFrom: field(pickupFrom), publishMode: "schedule", scheduledPublishAt },
      NOW
    );

  it("asks for a moment when none is chosen", () => {
    expect(scheduled(at(3, 9), "").schedule).toEqual({ kind: "required" });
  });

  it("refuses a moment already past", () => {
    expect(scheduled(at(3, 9), field(at(2, 9))).schedule).toEqual({ kind: "past" });
  });

  it("refuses a moment too close to the pickup, naming the latest that works", () => {
    // Thirty minutes to bid, plus fifteen for the publishing cron to get there.
    expect(scheduled(at(3, 9), field(at(3, 8, 50))).schedule).toEqual({
      kind: "tooClose",
      latest: at(3, 8, 15),
    });
  });

  it("keeps clear of the cron's lateness, not just the server's limit", () => {
    // 08:30 is the server's own limit — and expired the moment a late cron
    // reaches it, so the form does not offer it.
    expect(scheduled(at(3, 9), field(at(3, 8, 30))).schedule).toEqual({
      kind: "tooClose",
      latest: at(3, 8, 15),
    });
  });

  it("accepts the latest moment it names", () => {
    expect(scheduled(at(3, 9), field(at(3, 8, 15))).schedule).toBeNull();
  });

  it("says to publish now when no schedule could still work", () => {
    // 09:50, pickup at 10:30: the latest workable schedule, 09:45, has gone.
    const issues = publicationIssues(
      {
        pickupFrom: field(at(7, 10, 30)),
        publishMode: "schedule",
        scheduledPublishAt: field(at(7, 9, 55)),
      },
      at(7, 9, 50)
    );

    expect(issues.pickup).toBeNull();
    expect(issues.schedule).toEqual({ kind: "unschedulable" });
  });

  it.each([
    ["required", ""],
    ["past", field(at(2, 9))],
    ["tooClose", field(at(3, 8, 50))],
  ])("never warns beside a %s schedule", (_, value) => {
    expect(scheduled(at(3, 9), value).biddingClosesAt).toBeNull();
  });

  it("blames the pickup, not the schedule, when even now is too late", () => {
    const issues = scheduled(at(2, 14), field(at(2, 13, 55)));

    expect(issues.pickup).toEqual({ kind: "tooSoon", earliest: at(2, 14, 30) });
    expect(issues.schedule).toBeNull();
  });

  it("measures the warning from the scheduled moment", () => {
    const issues = scheduled(at(3, 9), field(at(3, 5)));

    expect(issues.schedule).toBeNull();
    expect(issues.biddingClosesAt).toEqual(at(3, 5, 30));
  });

  it("ignores the schedule entirely when publishing now", () => {
    const issues = publicationIssues(
      { pickupFrom: field(at(3, 9)), publishMode: "now", scheduledPublishAt: "" },
      NOW
    );

    expect(issues.schedule).toBeNull();
  });
});
