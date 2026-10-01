import { describe, it, expect } from "vitest";
import { showsDriverInvite } from "../driverInvite";

/** Every row of request_summary_spec.md §1. */
describe("showsDriverInvite", () => {
  it("hides the invite once there is an application, whatever the requests", () => {
    expect(showsDriverInvite({ hasApplication: true, requestCount: 0 })).toBe(false);
    expect(showsDriverInvite({ hasApplication: true, requestCount: 3 })).toBe(false);
    expect(showsDriverInvite({ hasApplication: true, requestCount: null })).toBe(false);
  });

  it("hides it while the caller's requests are still loading", () => {
    expect(showsDriverInvite({ hasApplication: false, requestCount: null })).toBe(false);
  });

  it("hides it from someone who has posted a request", () => {
    expect(showsDriverInvite({ hasApplication: false, requestCount: 1 })).toBe(false);
    expect(showsDriverInvite({ hasApplication: false, requestCount: 12 })).toBe(false);
  });

  it("shows it to someone with neither an application nor a request", () => {
    expect(showsDriverInvite({ hasApplication: false, requestCount: 0 })).toBe(true);
  });
});
