import { describe, it, expect, vi, beforeEach } from "vitest";

import { POST } from "../route";
import { auth } from "@/lib/auth";
import { threadOffersService } from "@/server/services/thread-offers.service";
import { OfferError } from "@/server/services/offers.service";

/**
 * The service has its own unit tests. What is exercised here is what the route
 * adds: the session gate, Zod translation, and passing a service error through
 * with its code rather than degrading it to a 500.
 *
 * Covers docs/specs/thread_offer_spec.md §12.
 */
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

vi.mock("@/server/services/thread-offers.service", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/server/services/thread-offers.service")
    >();
  return { ...actual, threadOffersService: { submit: vi.fn() } };
});

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
}));

const getSession = vi.mocked(auth.api.getSession);
const submit = vi.mocked(threadOffersService.submit);

const params = Promise.resolve({ id: "conv-1" });

const req = (body: unknown) =>
  new Request("http://localhost/api/messages/conversations/conv-1/offer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};

const VALID = {
  priceCents: 18000,
  pickupDay: tomorrow(),
  pickupSlot: "morning",
  deliveryLeadDays: 0,
  tzOffset: 0,
  vehicleId: "veh-1",
};

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({
    user: { id: "user-me", name: "Camille", image: null },
  } as never);
  submit.mockResolvedValue({
    threadOffer: { id: "to-1" },
    message: { id: "msg-1" },
  } as never);
});

describe("POST /api/messages/conversations/:id/offer", () => {
  it("refuses an anonymous caller", async () => {
    getSession.mockResolvedValue(null as never);

    const res = await POST(req(VALID), { params });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHENTICATED");
    expect(submit).not.toHaveBeenCalled();
  });

  it("returns the created offer with a 201 envelope", async () => {
    const res = await POST(req(VALID), { params });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toEqual({
      success: true,
      data: { threadOffer: { id: "to-1" }, message: { id: "msg-1" } },
    });
  });

  it("names the conversation from the path, never from the body", async () => {
    await POST(req({ ...VALID, conversationId: "conv-attacker" }), { params });

    expect(submit).toHaveBeenCalledWith(
      "user-me",
      "conv-1",
      expect.anything(),
      expect.anything()
    );
  });

  it("rejects the pre-slots contract, so an old client cannot half-succeed", async () => {
    const res = await POST(
      req({
        priceCents: 18000,
        estimatedPickup: new Date().toISOString(),
        estimatedDelivery: new Date().toISOString(),
        vehicleId: "veh-1",
      }),
      { params }
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(body.error.issues)).toBe(true);
    expect(submit).not.toHaveBeenCalled();
  });

  it("names a pickup slot that has already passed", async () => {
    const res = await POST(
      req({ ...VALID, pickupDay: "2020-01-01" }),
      { params }
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.issues[0].message).toBe("SLOT_IN_PAST");
  });

  it("passes an offers-engine error through with its code and status", async () => {
    submit.mockRejectedValue(new OfferError("CARRIER_NOT_APPROVED", 403));

    const res = await POST(req(VALID), { params });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("CARRIER_NOT_APPROVED");
  });

  it("passes a thread-offer error through rather than degrading it to 500", async () => {
    const { ThreadOfferError } = await import(
      "@/server/services/thread-offers.service"
    );
    submit.mockRejectedValue(new ThreadOfferError("THREAD_OFFER_LIVE", 409));

    const res = await POST(req(VALID), { params });
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error.code).toBe("THREAD_OFFER_LIVE");
  });
});
