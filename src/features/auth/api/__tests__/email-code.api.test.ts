import { afterEach, describe, expect, it, vi } from "vitest";

import { verifyEmailCode } from "../email-code.api";

/** How each answer of `POST /api/account/verify-email-code` reaches the page. */

function answer(status: number, body: unknown) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })
  );
}

const refused = (code: string, extra: Record<string, unknown> = {}) => ({
  success: false,
  error: { code, message: "refused", ...extra },
});

afterEach(() => vi.restoreAllMocks());

describe("verifyEmailCode (client)", () => {
  it("posts the address and the code", async () => {
    const fetchMock = answer(200, {
      success: true,
      data: { verified: true, email: "jean@mail.com" },
    });

    await expect(verifyEmailCode("jean@mail.com", "123456")).resolves.toEqual({
      status: "verified",
      email: "jean@mail.com",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/account/verify-email-code");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      email: "jean@mail.com",
      code: "123456",
    });
  });

  it("keeps the tries left on a wrong code", async () => {
    answer(400, refused("INVALID_CODE", { attemptsLeft: 2 }));

    await expect(verifyEmailCode("jean@mail.com", "000000")).resolves.toEqual({
      status: "invalid",
      attemptsLeft: 2,
    });
  });

  it.each([
    ["CODE_EXPIRED", 410, "expired"],
    ["TOO_MANY_ATTEMPTS", 429, "tooManyAttempts"],
    ["RATE_LIMITED", 429, "rateLimited"],
    ["VALIDATION_ERROR", 400, "failed"],
    ["INTERNAL_ERROR", 500, "failed"],
    ["constructor", 400, "failed"],
  ])("reads %s as %s", async (code, status, outcome) => {
    answer(status, refused(code));

    await expect(verifyEmailCode("jean@mail.com", "123456")).resolves.toEqual({
      status: outcome,
    });
  });

  it("reads a request that never arrived as a failure, never a throw", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(verifyEmailCode("jean@mail.com", "123456")).resolves.toEqual({
      status: "failed",
    });
  });
});
