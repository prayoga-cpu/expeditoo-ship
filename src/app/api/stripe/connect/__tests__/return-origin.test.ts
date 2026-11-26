import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Where a driver lands after Stripe's onboarding.
 *
 * The route used to fall back to `http://localhost:3000` when
 * `NEXT_PUBLIC_APP_URL` was unset, sending someone who had just finished
 * onboarding to a page that exists only on a developer's laptop. It now asks
 * `appUrl()`, whose fallback is the production origin
 * (docs/specs/payment_polish_2_99_3_spec.md §5).
 */

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("@/lib/impersonation-guard", () => ({ isImpersonated: vi.fn(() => false) }));
vi.mock("@/server/services/stripe.service", () => ({
  stripeService: { checkAccountStatus: vi.fn() },
}));

import { GET } from "../return/route";
import { auth } from "@/lib/auth";

const original = process.env.NEXT_PUBLIC_APP_URL;

describe("GET /api/stripe/connect/return — the address it sends the driver back to", () => {
  beforeEach(() => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
  });
  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = original;
  });

  it("goes to the production origin, never to localhost, when the variable is unset", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;

    const response = await GET();

    expect(response.headers.get("location")).toBe("https://www.expeditop.fr/profile?stripe=success");
  });

  it("goes to the deployment's own origin when it is set, without a doubled slash", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://dev.expeditop.fr/";

    const response = await GET();

    expect(response.headers.get("location")).toBe("https://dev.expeditop.fr/profile?stripe=success");
  });
});
