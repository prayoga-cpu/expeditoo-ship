import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SIDEBAR_RAIL_KEY, useSidebarRail } from "../use-sidebar-rail";

/**
 * The sidebar's default is drawn by CSS (`data-rail="auto"`), so the hook only
 * has to answer which way an unchosen sidebar currently leans, and to remember
 * a choice without ever failing on storage.
 */

function mockWidth(wide: boolean) {
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: wide,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

describe("useSidebarRail", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("is a rail between lg and xl when nobody has chosen", () => {
    mockWidth(false);
    const { result } = renderHook(() => useSidebarRail());
    expect(result.current.state).toBe("auto");
    expect(result.current.expanded).toBe(false);
  });

  it("is expanded from xl when nobody has chosen", () => {
    mockWidth(true);
    const { result } = renderHook(() => useSidebarRail());
    expect(result.current.state).toBe("auto");
    expect(result.current.expanded).toBe(true);
  });

  it("toggles away from the default and remembers the choice", () => {
    mockWidth(false);
    const { result } = renderHook(() => useSidebarRail());

    act(() => result.current.toggle());

    expect(result.current.state).toBe("off");
    expect(result.current.expanded).toBe(true);
    expect(window.localStorage.getItem(SIDEBAR_RAIL_KEY)).toBe("expanded");

    act(() => result.current.toggle());
    expect(result.current.state).toBe("on");
    expect(window.localStorage.getItem(SIDEBAR_RAIL_KEY)).toBe("rail");
  });

  it("applies a stored choice over the width, after mount", () => {
    mockWidth(true);
    window.localStorage.setItem(SIDEBAR_RAIL_KEY, "rail");
    const { result } = renderHook(() => useSidebarRail());
    expect(result.current.state).toBe("on");
    expect(result.current.expanded).toBe(false);
  });

  it("ignores a stored value it does not know", () => {
    mockWidth(false);
    window.localStorage.setItem(SIDEBAR_RAIL_KEY, "banana");
    const { result } = renderHook(() => useSidebarRail());
    expect(result.current.state).toBe("auto");
  });

  it("stays silent when storage throws, and the choice still applies", () => {
    mockWidth(false);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { result } = renderHook(() => useSidebarRail());
    expect(result.current.state).toBe("auto");

    act(() => result.current.toggle());

    expect(result.current.expanded).toBe(true);
  });

  it("copes with a browser that has no matchMedia", () => {
    // @ts-expect-error -- simulating an old webview
    window.matchMedia = undefined;
    const { result } = renderHook(() => useSidebarRail());
    expect(result.current.expanded).toBe(false);
  });
});
