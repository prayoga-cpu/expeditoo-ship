import { describe, expect, it } from "vitest";

import {
  isJobReference,
  isLandingIntent,
  resolveLandingDestination,
  type LandingSession,
} from "../landing-intent";

/**
 * The whole redirect matrix of `docs/specs/landing_gated_actions_spec.md` §2,
 * which is why the resolver is a pure function: no router, no session, no DOM.
 */

const SIGNED_IN: LandingSession = { isAuthenticated: true, isReturning: true };
const RETURNING: LandingSession = { isAuthenticated: false, isReturning: true };
const FIRST_TIME: LandingSession = {
  isAuthenticated: false,
  isReturning: false,
};

describe("resolveLandingDestination", () => {
  it("sends a signed-in visitor into the app, never to an auth page", () => {
    expect(resolveLandingDestination("bid", SIGNED_IN)).toBe("/expedion");
    expect(resolveLandingDestination("jobs", SIGNED_IN)).toBe("/expedion");
    expect(resolveLandingDestination("carrier", SIGNED_IN)).toBe("/profile");
  });

  it("ignores the reference once there is a session", () => {
    expect(resolveLandingDestination("bid", SIGNED_IN, "EX-2481")).toBe(
      "/expedion"
    );
  });

  it("sends a device that has had a session to login", () => {
    expect(resolveLandingDestination("bid", RETURNING)).toBe(
      "/signin?intent=bid"
    );
    expect(resolveLandingDestination("jobs", RETURNING)).toBe(
      "/signin?intent=jobs"
    );
    expect(resolveLandingDestination("carrier", RETURNING)).toBe(
      "/signin?intent=carrier"
    );
  });

  it("sends a first-time device to signup — there is nothing to log in to", () => {
    expect(resolveLandingDestination("bid", FIRST_TIME)).toBe(
      "/signup?intent=bid"
    );
    expect(resolveLandingDestination("jobs", FIRST_TIME)).toBe(
      "/signup?intent=jobs"
    );
    expect(resolveLandingDestination("carrier", FIRST_TIME)).toBe(
      "/signup?intent=carrier"
    );
  });

  it("carries the job reference to the auth page", () => {
    expect(resolveLandingDestination("bid", FIRST_TIME, "EX-2481")).toBe(
      "/signup?intent=bid&ref=EX-2481"
    );
    expect(resolveLandingDestination("bid", RETURNING, "EX-2481")).toBe(
      "/signin?intent=bid&ref=EX-2481"
    );
  });

  it("encodes a reference that would otherwise break the query", () => {
    expect(resolveLandingDestination("bid", FIRST_TIME, "EX 24&81")).toBe(
      "/signup?intent=bid&ref=EX+24%2681"
    );
  });

  it("omits the reference when none is given", () => {
    expect(resolveLandingDestination("bid", FIRST_TIME, "")).toBe(
      "/signup?intent=bid"
    );
  });
});

describe("isLandingIntent", () => {
  it("accepts the union and nothing else", () => {
    expect(isLandingIntent("bid")).toBe(true);
    expect(isLandingIntent("jobs")).toBe(true);
    expect(isLandingIntent("carrier")).toBe(true);
  });

  it("rejects anything a hand-edited query could carry", () => {
    expect(isLandingIntent("BID")).toBe(false);
    expect(isLandingIntent("")).toBe(false);
    expect(isLandingIntent(null)).toBe(false);
    expect(isLandingIntent(undefined)).toBe(false);
    expect(isLandingIntent(2)).toBe(false);
  });
});

describe("isJobReference", () => {
  it("accepts the shape the board actually issues", () => {
    expect(isJobReference("EX-2481")).toBe(true);
    expect(isJobReference("EX2481")).toBe(true);
    expect(isJobReference("a")).toBe(true);
  });

  it("refuses anything that could carry a message", () => {
    expect(isJobReference("Your account is locked, call 555-0100")).toBe(false);
    expect(isJobReference("EX 2481")).toBe(false);
    expect(isJobReference("<b>EX</b>")).toBe(false);
    expect(isJobReference("https://evil.example")).toBe(false);
    expect(isJobReference("-EX2481")).toBe(false);
    expect(isJobReference("E".repeat(25))).toBe(false);
    expect(isJobReference("")).toBe(false);
    expect(isJobReference(null)).toBe(false);
    expect(isJobReference(42)).toBe(false);
  });
});
