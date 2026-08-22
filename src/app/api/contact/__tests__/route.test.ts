import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

import { POST } from "../route";
import { auth } from "@/lib/auth";
import { contactService, ContactError } from "@/server/services/contact.service";
import { resetRateLimits } from "@/lib/rate-limit";

/**
 * `contactService` is mocked — its behaviour has its own unit tests. What is
 * exercised here is what the route adds: the rate limit, the optional session,
 * and error translation.
 */
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

vi.mock("@/server/services/contact.service", async () => {
  const actual = await vi.importActual<
    typeof import("@/server/services/contact.service")
  >("@/server/services/contact.service");
  return {
    ...actual,
    contactService: { submit: vi.fn() },
  };
});

// `headers()` reads the request the route was invoked with; in a unit test
// there is no request scope, so it is stubbed per call.
const requestHeaders = { current: new Headers() };
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(requestHeaders.current),
}));

const getSessionMock = vi.mocked(auth.api.getSession);
const submitMock = vi.mocked(contactService.submit);

const VALID = {
  name: "Camille Roux",
  email: "camille@example.com",
  subject: "carrier",
  message: "I drive a 12m3 van out of Lyon and would like to apply.",
};

function req(body: unknown, ip = "203.0.113.10") {
  requestHeaders.current = new Headers({ "x-forwarded-for": ip });
  return new NextRequest("http://localhost/api/contact", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/contact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimits();
    getSessionMock.mockResolvedValue(null as never);
    submitMock.mockResolvedValue({ delivered: true, threadOpened: false });
  });

  it("accepts a submission with no session at all", async () => {
    const res = await POST(req(VALID));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      success: true,
      data: { delivered: true, threadOpened: false },
    });
    expect(submitMock.mock.calls[0][1]).toMatchObject({ sender: null });
  });

  it("passes a signed-in sender down to the service", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "user_1", name: "Camille", image: null },
      session: {},
    } as never);

    await POST(req(VALID));

    expect(submitMock.mock.calls[0][1]).toMatchObject({
      sender: { id: "user_1", name: "Camille", image: null },
      impersonated: false,
    });
  });

  it("flags a borrowed session so no thread is written", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "user_1", name: "Camille", image: null },
      session: { impersonatedBy: "admin_9" },
    } as never);

    await POST(req(VALID));

    expect(submitMock.mock.calls[0][1]).toMatchObject({ impersonated: true });
  });

  it("rejects an invalid body with field issues", async () => {
    const res = await POST(req({ ...VALID, message: "hi" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.issues.map((i: { path: string }) => i.path)).toContain(
      "message"
    );
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("translates a service error into its own code and status", async () => {
    submitMock.mockRejectedValue(
      new ContactError("CONTACT_DELIVERY_FAILED", "Undeliverable", 502)
    );

    const res = await POST(req(VALID));

    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe("CONTACT_DELIVERY_FAILED");
  });

  it("rate limits a single address after five submissions", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await POST(req(VALID))).status).toBe(200);
    }

    const res = await POST(req(VALID));
    expect(res.status).toBe(429);
    expect((await res.json()).error.code).toBe("CONTACT_RATE_LIMITED");
    // The blocked call must never reach the service.
    expect(submitMock).toHaveBeenCalledTimes(5);
  });

  it("limits per address rather than globally", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await POST(req(VALID, "203.0.113.10"));
    }

    expect((await POST(req(VALID, "198.51.100.7"))).status).toBe(200);
  });
});
