import { afterEach, describe, expect, it, vi } from "vitest";

import {
  RETURNING_VISITOR_KEY,
  isReturningVisitor,
  markReturningVisitor,
} from "../returning-visitor";

/**
 * The flag decides login vs signup, so it has to survive a store that is
 * missing, cleared or actively throwing — every one of those degrades to
 * "first-time visitor", never to a crash on the landing page.
 */

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("returning visitor flag", () => {
  it("reports false on a device that has never held a session", () => {
    expect(isReturningVisitor()).toBe(false);
  });

  it("reports true once marked, and survives being marked twice", () => {
    markReturningVisitor();
    markReturningVisitor();

    expect(window.localStorage.getItem(RETURNING_VISITOR_KEY)).toBe("1");
    expect(isReturningVisitor()).toBe(true);
  });

  it("treats any other stored value as not returning", () => {
    window.localStorage.setItem(RETURNING_VISITOR_KEY, "true");
    expect(isReturningVisitor()).toBe(false);
  });

  it("does not throw when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });

    expect(() => markReturningVisitor()).not.toThrow();
    expect(isReturningVisitor()).toBe(false);
  });
});
