import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * What the route adds to the service: the session, and the translation of a
 * typed error into a status the browser can act on.
 *
 * Every failure used to leave here as a 500 whose body carried Stripe's own
 * message, so the profile screen — which only ever looked for a `url` — had
 * nothing to show and said nothing at all.
 */

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

vi.mock("@/server/services/stripe.service", async () => {
  const actual = await vi.importActual<
    typeof import("@/server/services/stripe.service")
  >("@/server/services/stripe.service");
  return {
    ...actual,
    stripeService: {
      createConnectAccount: vi.fn(),
      createAccountLink: vi.fn(),
    },
  };
});

import { POST } from "../route";
import { auth } from "@/lib/auth";
import {
  stripeService,
  StripeConnectError,
} from "@/server/services/stripe.service";

const getSessionMock = vi.mocked(auth.api.getSession);
const createAccountMock = vi.mocked(stripeService.createConnectAccount);
const createLinkMock = vi.mocked(stripeService.createAccountLink);

const req = () =>
  new Request("http://localhost/api/stripe/connect", { method: "POST" });

const body = async (response: Response) =>
  (await response.json()) as {
    success: boolean;
    data?: { url: string };
    error?: { code: string; message: string };
  };

beforeEach(() => {
  vi.clearAllMocks();
  getSessionMock.mockResolvedValue({ user: { id: "carrier-1" } } as never);
  createAccountMock.mockResolvedValue("acct_123");
  createLinkMock.mockResolvedValue("https://connect.stripe.com/setup/acct_123");
});

describe("POST /api/stripe/connect", () => {
  it("refuses an unauthenticated caller, and creates no account", async () => {
    getSessionMock.mockResolvedValue(null as never);

    const response = await POST(req());

    expect(response.status).toBe(401);
    expect(createAccountMock).not.toHaveBeenCalled();
  });

  it("still returns the onboarding link on the happy path", async () => {
    const response = await POST(req());

    expect(response.status).toBe(200);
    expect(await body(response)).toEqual({
      success: true,
      data: { url: "https://connect.stripe.com/setup/acct_123" },
    });
    expect(createLinkMock).toHaveBeenCalledWith("acct_123");
  });

  it("answers a Stripe refusal with its own status and code", async () => {
    createAccountMock.mockRejectedValue(
      new StripeConnectError(
        "STRIPE_REQUEST_REJECTED",
        422,
        "Stripe refused this request"
      )
    );

    const response = await POST(req());
    const payload = await body(response);

    // Was a 500 with Stripe's prose in it. Stripe answering 400 is not this
    // server falling over, and the screen keys its message off the code.
    expect(response.status).toBe(422);
    expect(payload.error?.code).toBe("STRIPE_REQUEST_REJECTED");
    expect(payload.error?.message).not.toContain("restricted");
  });

  it("still answers 500 when the failure is genuinely ours", async () => {
    createLinkMock.mockRejectedValue(new Error("socket hang up"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await POST(req());
    const payload = await body(response);

    expect(response.status).toBe(500);
    expect(payload.error?.code).toBe("INTERNAL_ERROR");
    // The underlying message stays in the log, never in the answer.
    expect(payload.error?.message).toBe("Something went wrong");
  });
});
