import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { POST } from "../route";
import {
  EmailCodeError,
  verifyEmailCode,
} from "@/server/services/email-code.service";
import { resetRateLimits } from "@/lib/rate-limit";

/**
 * The service is mocked — its rules have their own tests. What the route adds
 * is the validation, the per-IP brake, and how a refusal reaches the page
 * (email_access_code_spec.md §5).
 */
vi.mock("@/server/services/email-code.service", async () => {
  const actual = await vi.importActual<
    typeof import("@/server/services/email-code.service")
  >("@/server/services/email-code.service");
  return { ...actual, verifyEmailCode: vi.fn() };
});

const verifyMock = vi.mocked(verifyEmailCode);

function req(body: unknown, ip = "203.0.113.10") {
  return new NextRequest("http://localhost/api/account/verify-email-code", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
  });
}

describe("POST /api/account/verify-email-code", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimits();
    verifyMock.mockResolvedValue({ email: "jean@mail.com", newlyVerified: true });
  });

  it("verifies with no session, and answers the address and nothing else", async () => {
    const res = await POST(req({ email: "Jean@Mail.com ", code: "123456" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      data: { verified: true, email: "jean@mail.com" },
    });
    expect(verifyMock).toHaveBeenCalledWith("jean@mail.com", "123456");
  });

  it("takes a code pasted with a space in it", async () => {
    await POST(req({ email: "jean@mail.com", code: " 123 456 " }));

    expect(verifyMock).toHaveBeenCalledWith("jean@mail.com", "123456");
  });

  it.each([
    ["five digits", { email: "jean@mail.com", code: "12345" }],
    ["seven digits", { email: "jean@mail.com", code: "1234567" }],
    ["letters", { email: "jean@mail.com", code: "12a456" }],
    ["no code", { email: "jean@mail.com" }],
    ["not an address", { email: "jean", code: "123456" }],
  ])("refuses %s before the service counts an attempt", async (_label, body) => {
    const res = await POST(req(body));

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it("answers a body that is not JSON as a bad request, not a crash", async () => {
    const res = await POST(req("{not json"));

    expect(res.status).toBe(400);
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it("says how many tries are left on a wrong code", async () => {
    verifyMock.mockRejectedValue(
      new EmailCodeError("INVALID_CODE", 400, "Wrong code. 3 attempt(s) left.", 3)
    );

    const res = await POST(req({ email: "jean@mail.com", code: "123456" }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toEqual({
      code: "INVALID_CODE",
      message: "Wrong code. 3 attempt(s) left.",
      attemptsLeft: 3,
    });
  });

  it.each([
    ["CODE_EXPIRED", 410],
    ["TOO_MANY_ATTEMPTS", 429],
  ] as const)("passes %s through with its status", async (code, status) => {
    verifyMock.mockRejectedValue(new EmailCodeError(code, status, "refused"));

    const res = await POST(req({ email: "jean@mail.com", code: "123456" }));
    const body = await res.json();

    expect(res.status).toBe(status);
    expect(body.error.code).toBe(code);
    expect(body.error).not.toHaveProperty("attemptsLeft");
  });

  it("does not leak an unexpected failure", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    verifyMock.mockRejectedValue(new Error("connection refused at 10.0.0.3"));

    const res = await POST(req({ email: "jean@mail.com", code: "123456" }));

    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("10.0.0.3");
    consoleError.mockRestore();
  });

  it("brakes one IP after ten tries a minute, and only that one", async () => {
    for (let i = 0; i < 10; i += 1) {
      expect((await POST(req({ email: "jean@mail.com", code: "123456" }))).status).toBe(200);
    }

    const blocked = await POST(req({ email: "jean@mail.com", code: "123456" }));
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).error.code).toBe("RATE_LIMITED");
    expect(verifyMock).toHaveBeenCalledTimes(10);

    const elsewhere = await POST(req({ email: "jean@mail.com", code: "123456" }, "198.51.100.7"));
    expect(elsewhere.status).toBe(200);
  });
});
