import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prefetch = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ prefetch }) }));

import { useNavPrefetch } from "../use-nav-prefetch";

/**
 * 2.96.0 #36: a tap on the navigation lands on a route the router already
 * holds. Half of each shell's destinations sat in a hidden sidebar or a
 * hidden bar, where `<Link>`'s viewport prefetch never reached them.
 */

let idle: Array<() => void> = [];

beforeEach(() => {
  prefetch.mockClear();
  idle = [];
  window.requestIdleCallback = ((cb: () => void) => {
    idle.push(cb);
    return idle.length;
  }) as unknown as typeof window.requestIdleCallback;
  window.cancelIdleCallback = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
});

const flushIdle = () => {
  const pending = idle;
  idle = [];
  pending.forEach((cb) => cb());
};

describe("useNavPrefetch", () => {
  it("waits for an idle moment, then asks for every destination once", () => {
    renderHook(() => useNavPrefetch(["/home", "/messages", "/home", "/profile"], { enabled: true }));
    expect(prefetch).not.toHaveBeenCalled();

    flushIdle();
    expect(prefetch.mock.calls.map(([href]) => href)).toEqual(["/home", "/messages", "/profile"]);
  });

  it("asks only for what a later list adds — the role-dependent entries", () => {
    const { rerender } = renderHook(({ hrefs }) => useNavPrefetch(hrefs, { enabled: true }), {
      initialProps: { hrefs: ["/home", "/messages"] as string[] },
    });
    flushIdle();
    prefetch.mockClear();

    rerender({ hrefs: ["/home", "/create", "/listings/me", "/messages"] });
    flushIdle();
    expect(prefetch.mock.calls.map(([href]) => href)).toEqual(["/create", "/listings/me"]);
  });

  it("does not re-run for a new array with the same entries", () => {
    const { rerender } = renderHook(({ hrefs }) => useNavPrefetch(hrefs, { enabled: true }), {
      initialProps: { hrefs: ["/home"] },
    });
    flushIdle();
    rerender({ hrefs: ["/home"] });
    flushIdle();
    expect(prefetch).toHaveBeenCalledTimes(1);
  });

  it("skips empty and outside links", () => {
    renderHook(() =>
      useNavPrefetch(["/home", null, undefined, "", "https://example.com"], { enabled: true })
    );
    flushIdle();
    expect(prefetch.mock.calls.map(([href]) => href)).toEqual(["/home"]);
  });

  it("cancels a pending run when the page goes away first", () => {
    const { unmount } = renderHook(() => useNavPrefetch(["/home"], { enabled: true }));
    unmount();
    expect(window.cancelIdleCallback).toHaveBeenCalled();
  });

  it("falls back to a timer where there is no requestIdleCallback (Safari)", () => {
    vi.useFakeTimers();
    // @ts-expect-error — removing the API to stand in for Safari
    delete window.requestIdleCallback;
    renderHook(() => useNavPrefetch(["/messages"], { enabled: true }));
    expect(prefetch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(250);
    expect(prefetch).toHaveBeenCalledWith("/messages");
  });

  it("is off outside production, like <Link>'s own prefetching", () => {
    renderHook(() => useNavPrefetch(["/home"]));
    flushIdle();
    expect(prefetch).not.toHaveBeenCalled();
  });
});
