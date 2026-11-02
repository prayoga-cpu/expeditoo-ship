import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The return address PayPal sends the requester back to, and its reading
 * (docs/specs/payment_alternatives_spec.md §3).
 */

const nav = vi.hoisted(() => ({ params: new URLSearchParams() as URLSearchParams | null }));
vi.mock("next/navigation", () => ({ useSearchParams: () => nav.params }));

import { acceptReturnUrl, useAcceptReturn } from "../useAcceptReturn";

beforeEach(() => {
  window.history.replaceState(null, "", "/listing/job-1?tab=details");
});

describe("acceptReturnUrl", () => {
  it("is this page, naming the offer and the slot, keeping the tab", () => {
    const url = new URL(acceptReturnUrl("offer-1", "slot-2"));

    expect(url.pathname).toBe("/listing/job-1");
    expect(url.searchParams.get("tab")).toBe("details");
    expect(url.searchParams.get("acceptOffer")).toBe("offer-1");
    expect(url.searchParams.get("acceptSlot")).toBe("slot-2");
  });

  it("drops what an earlier return left behind", () => {
    window.history.replaceState(
      null,
      "",
      "/listing/job-1?acceptOffer=old&payment_intent=pi_old&redirect_status=failed"
    );

    const url = new URL(acceptReturnUrl("offer-1"));

    expect(url.searchParams.get("acceptOffer")).toBe("offer-1");
    expect(url.searchParams.has("payment_intent")).toBe(false);
    expect(url.searchParams.has("redirect_status")).toBe(false);
    expect(url.searchParams.has("acceptSlot")).toBe(false);
  });
});

describe("useAcceptReturn", () => {
  it("reads nothing on an ordinary visit, or outside the app router", () => {
    nav.params = new URLSearchParams("tab=details");
    expect(renderHook(() => useAcceptReturn()).result.current.resume).toBeNull();
    nav.params = null;
    expect(renderHook(() => useAcceptReturn()).result.current.resume).toBeNull();
  });

  it("reads a return, and whether it was approved", () => {
    nav.params = new URLSearchParams(
      "tab=details&acceptOffer=offer-1&acceptSlot=slot-2&payment_intent=pi_1&payment_intent_client_secret=s&redirect_status=succeeded"
    );
    expect(renderHook(() => useAcceptReturn()).result.current.resume).toEqual({
      offerId: "offer-1",
      slotId: "slot-2",
      paymentIntentId: "pi_1",
      failed: false,
    });

    nav.params!.set("redirect_status", "failed");
    expect(renderHook(() => useAcceptReturn()).result.current.resume?.failed).toBe(true);
  });

  it("clears the return and keeps the rest, so a reload does not try again", () => {
    const back =
      "tab=details&acceptOffer=offer-1&payment_intent=pi_1&payment_intent_client_secret=s&redirect_status=succeeded";
    nav.params = new URLSearchParams(back);
    window.history.replaceState(null, "", `/listing/job-1?${back}`);

    renderHook(() => useAcceptReturn()).result.current.clear();

    expect(window.location.pathname + window.location.search).toBe("/listing/job-1?tab=details");
  });
});
