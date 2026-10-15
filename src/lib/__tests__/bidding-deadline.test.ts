import { describe, expect, it } from "vitest";

import {
  BIDDING_LEAD_MS,
  MIN_BIDDING_WINDOW_MS,
  REBOARD_LEAD_MS,
  biddingDeadline,
  biddingRunsUntil,
  expiresAtFor,
  rearmedExpiry,
  rearmedWindow,
} from "../listing-window";

/**
 * client_feedback_2026_10_spec.md §4. The client published a request
 * collecting 8–31 October and read « offres jusqu'au 8 oct. à 00:00 »; they
 * asked for the 31st. A flexible direct request now takes offers until 6 h
 * before its pickup window ends. Whether it may go live at all is unchanged.
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const NOW = new Date("2026-10-07T21:30:00.000Z");
const at = (ms: number) => new Date(NOW.getTime() + ms);

// The client's request: 8 Oct 06:00 → 31 Oct 22:00, Paris (UTC+2 / UTC+1).
const PICKUP_FROM = new Date("2026-10-08T04:00:00.000Z");
const PICKUP_UNTIL = new Date("2026-10-31T21:00:00.000Z");

describe("biddingRunsUntil", () => {
  const flexible = { isFlexible: true, pickupUntil: PICKUP_UNTIL };
  const exact = { isFlexible: false, pickupUntil: PICKUP_UNTIL };

  it("runs a flexible direct request to the end of its window", () => {
    expect(biddingRunsUntil(flexible, true)).toEqual(PICKUP_UNTIL);
  });

  it("leaves an escalated job and an exact request on their start", () => {
    expect(biddingRunsUntil(flexible, false)).toBeNull();
    expect(biddingRunsUntil(exact, true)).toBeNull();
  });
});

describe("biddingDeadline", () => {
  it("closes the client's request six hours before 31 October ends", () => {
    expect(biddingDeadline(PICKUP_FROM, PICKUP_UNTIL, NOW)).toEqual(
      new Date(PICKUP_UNTIL.getTime() - BIDDING_LEAD_MS)
    );
  });

  it("is exactly the old deadline without a window end", () => {
    expect(biddingDeadline(PICKUP_FROM, null, NOW)).toEqual(
      expiresAtFor(PICKUP_FROM, NOW)
    );
  });

  it("refuses exactly what was refused before: the start still decides", () => {
    // Twenty minutes out is too soon to publish, however long the window runs.
    const soon = at(20 * MINUTE);
    expect(biddingDeadline(soon, at(10 * DAY), NOW)).toBeNull();
    expect(expiresAtFor(soon, NOW)).toBeNull();
  });

  it("never closes earlier than it would have on the start", () => {
    // Start in 1 h (30-minute clamp), end in 6 h 10 min (6 h lead → 10 min).
    const start = at(HOUR);
    const end = at(6 * HOUR + 10 * MINUTE);
    expect(biddingDeadline(start, end, NOW)).toEqual(at(MIN_BIDDING_WINDOW_MS));
  });

  it("ignores a window end that is not after the start", () => {
    expect(biddingDeadline(PICKUP_FROM, PICKUP_FROM, NOW)).toEqual(
      expiresAtFor(PICKUP_FROM, NOW)
    );
  });
});

describe("re-boarding a flexible direct request", () => {
  const window = {
    pickupFrom: PICKUP_FROM,
    pickupUntil: PICKUP_UNTIL,
    dropoffFrom: new Date("2026-10-09T04:00:00.000Z"),
    dropoffUntil: new Date("2026-11-02T21:00:00.000Z"),
  };
  // A transporter withdraws on 15 October: the window started a week ago.
  const midWindow = new Date("2026-10-15T10:00:00.000Z");

  it("keeps the requester's dates while the window still has room", () => {
    const rearmed = rearmedWindow(window, midWindow, true);
    expect(rearmed.pickupFrom).toEqual(window.pickupFrom);
    expect(rearmed.pickupUntil).toEqual(window.pickupUntil);
    expect(rearmed.expiresAt).toEqual(
      new Date(PICKUP_UNTIL.getTime() - BIDDING_LEAD_MS)
    );
  });

  it("slides the window as before when it closes on its start", () => {
    const rearmed = rearmedWindow(window, midWindow, false);
    expect(rearmed.pickupFrom).toEqual(new Date(midWindow.getTime() + REBOARD_LEAD_MS));
  });

  it("repairs only the deadline for a declined card, from the window end", () => {
    expect(rearmedExpiry(PICKUP_FROM, midWindow, PICKUP_UNTIL)).toEqual(
      new Date(PICKUP_UNTIL.getTime() - BIDDING_LEAD_MS)
    );
    expect(rearmedExpiry(PICKUP_FROM, midWindow)).toBeNull();
  });

  it("slides once even the window end leaves no usable room", () => {
    const lateInWindow = new Date(PICKUP_UNTIL.getTime() - 10 * MINUTE);
    const rearmed = rearmedWindow(window, lateInWindow, true);
    expect(rearmed.pickupFrom).toEqual(
      new Date(lateInWindow.getTime() + REBOARD_LEAD_MS)
    );
    expect(rearmed.expiresAt.getTime()).toBeGreaterThan(lateInWindow.getTime());
  });
});
