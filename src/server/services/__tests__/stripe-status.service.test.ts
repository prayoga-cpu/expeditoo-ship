import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const stripeMock = vi.hoisted(() => ({
  accounts: { retrieveCurrent: vi.fn() },
  webhookEndpoints: { list: vi.fn() },
}));

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/lib/stripe", () => ({ stripe: stripeMock }));
vi.mock("@/server/dal/users.dal", () => ({ userHasRole: vi.fn() }));
vi.mock("@/server/dal/payments.dal", () => ({ paymentsDal: { realChargeSummary: vi.fn() } }));
vi.mock("@/server/dal/stripe-webhook-heartbeat.dal", () => ({
  stripeWebhookHeartbeatDal: { get: vi.fn() },
}));
// Only the event list is needed from it; the real module pulls in payments.
vi.mock("@/server/services/stripe.service", () => ({
  HANDLED_STRIPE_EVENTS: ["account.updated", "payment_intent.succeeded"],
}));

import {
  appHosts,
  endpointKind,
  keyMode,
  stripeStatusService,
  StripeStatusError,
} from "../stripe-status.service";
import { userHasRole } from "@/server/dal/users.dal";
import { paymentsDal } from "@/server/dal/payments.dal";
import { stripeWebhookHeartbeatDal } from "@/server/dal/stripe-webhook-heartbeat.dal";

/** launch_readiness_spec.md §B — is this deployment ready to take real money. */

const ENV = {
  STRIPE_SECRET_KEY: "sk_live_abc",
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_abc",
  NEXT_PUBLIC_APP_URL: "https://expeditoo-ship-five.vercel.app",
  MOCK_PAYMENTS: "",
};
const before: Record<string, string | undefined> = {};

const ENDPOINT_HERE = {
  url: "https://expeditoo-ship-five.vercel.app/api/stripe/webhook",
  status: "enabled",
  enabled_events: ["account.updated", "payment_intent.succeeded"],
};
const N8N = {
  url: "https://agsexp.app.n8n.cloud/webhook/stripe",
  status: "enabled",
  enabled_events: ["checkout.session.completed"],
};

beforeEach(() => {
  vi.clearAllMocks();
  for (const [key, value] of Object.entries(ENV)) {
    before[key] = process.env[key];
    process.env[key] = value;
  }
  vi.mocked(userHasRole).mockImplementation(async (_id, role) => role === "admin");
  stripeMock.accounts.retrieveCurrent.mockResolvedValue({
    id: "acct_1",
    business_profile: { name: "ATOUT GLOBAL SERVICES" },
    settings: null,
    charges_enabled: true,
    payouts_enabled: true,
    details_submitted: true,
  });
  stripeMock.webhookEndpoints.list.mockResolvedValue({ data: [ENDPOINT_HERE, N8N] });
  vi.mocked(stripeWebhookHeartbeatDal.get).mockResolvedValue({
    id: "default",
    lastEventAt: new Date("2026-10-17T09:00:00Z"),
    lastEventType: "payment_intent.succeeded",
    lastEventLivemode: true,
  });
  vi.mocked(paymentsDal.realChargeSummary).mockResolvedValue({
    realCount: 1,
    firstRealAt: new Date("2026-10-17T09:00:00Z"),
    lastRealAt: new Date("2026-10-17T09:00:00Z"),
    mockCount: 3,
  });
});

afterEach(() => {
  for (const key of Object.keys(ENV)) {
    if (before[key] === undefined) delete process.env[key];
    else process.env[key] = before[key];
  }
});

const states = (checks: { key: string; state: string }[]) =>
  Object.fromEntries(checks.map((c) => [c.key, c.state]));

describe("keyMode", () => {
  it.each([
    ["sk_live_x", "secret", "live"],
    ["rk_live_x", "secret", "live"],
    ["sk_test_x", "secret", "test"],
    ["pk_live_x", "publishable", "live"],
    ["pk_test_x", "publishable", "test"],
    ["", "secret", "missing"],
    [undefined, "publishable", "missing"],
    ["pk_live_x", "secret", "unknown"],
  ] as const)("%s as a %s key is %s", (key, kind, mode) => {
    expect(keyMode(key, kind)).toBe(mode);
  });
});

describe("endpointKind", () => {
  const hosts = ["expeditoo-ship-five.vercel.app"];
  it("knows this app's webhook, by host and path", () => {
    expect(endpointKind(ENDPOINT_HERE.url, hosts)).toBe("thisApp");
    expect(endpointKind(`${ENDPOINT_HERE.url}/`, hosts)).toBe("thisApp");
  });
  it("tells this app's path on another address apart from a stranger", () => {
    expect(endpointKind("https://expeditoo.fr/api/stripe/webhook", hosts)).toBe(
      "thisPathOtherHost"
    );
    expect(endpointKind(N8N.url, hosts)).toBe("other");
    expect(endpointKind("not a url", hosts)).toBe("other");
  });
});

describe("appHosts", () => {
  it("collects every address the deployment knows itself by", () => {
    expect(
      appHosts({
        NEXT_PUBLIC_APP_URL: "https://a.example/",
        VERCEL_PROJECT_PRODUCTION_URL: "b.example",
        VERCEL_URL: "c-123.vercel.app",
        BETTER_AUTH_URL: "not a url",
      } as unknown as NodeJS.ProcessEnv).sort()
    ).toEqual(["a.example", "b.example", "c-123.vercel.app"]);
  });
});

describe("stripeStatusService.getForAdmin", () => {
  it("refuses anyone but admin or finance, before asking Stripe", async () => {
    vi.mocked(userHasRole).mockResolvedValue(false);

    await expect(stripeStatusService.getForAdmin("u")).rejects.toBeInstanceOf(
      StripeStatusError
    );
    expect(stripeMock.accounts.retrieveCurrent).not.toHaveBeenCalled();
  });

  it("is all green on a live, wired, exercised deployment", async () => {
    const view = await stripeStatusService.getForAdmin("admin");

    expect(states(view.checks)).toEqual({
      liveKeys: "ok",
      mockOff: "ok",
      chargesEnabled: "ok",
      webhookEndpoint: "ok",
      webhookReceived: "ok",
      firstRealPayment: "ok",
    });
    expect(view.account).toMatchObject({ reachable: true, name: "ATOUT GLOBAL SERVICES" });
  });

  it("lists the other endpoints on the account without counting them as this app's", async () => {
    stripeMock.webhookEndpoints.list.mockResolvedValue({ data: [N8N] });

    const view = await stripeStatusService.getForAdmin("admin");

    expect(states(view.checks).webhookEndpoint).toBe("todo");
    expect(view.webhooks).toEqual({
      reachable: true,
      endpoints: [{ url: N8N.url, status: "enabled", kind: "other", coversHandledEvents: false }],
    });
  });

  it("does not count an endpoint that misses an event this app handles", async () => {
    stripeMock.webhookEndpoints.list.mockResolvedValue({
      data: [{ ...ENDPOINT_HERE, enabled_events: ["account.updated"] }],
    });

    const view = await stripeStatusService.getForAdmin("admin");

    expect(states(view.checks).webhookEndpoint).toBe("todo");
  });

  it("says what is still to do before launch", async () => {
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_abc";
    vi.mocked(stripeWebhookHeartbeatDal.get).mockResolvedValue(undefined);
    vi.mocked(paymentsDal.realChargeSummary).mockResolvedValue({
      realCount: 0,
      firstRealAt: null,
      lastRealAt: null,
      mockCount: 3,
    });

    const view = await stripeStatusService.getForAdmin("admin");

    expect(states(view.checks)).toMatchObject({
      liveKeys: "todo",
      webhookReceived: "todo",
      firstRealPayment: "todo",
    });
  });

  it("reports Stripe failing to answer as a failed check, not a crash", async () => {
    stripeMock.accounts.retrieveCurrent.mockRejectedValue(new Error("Invalid API Key"));
    stripeMock.webhookEndpoints.list.mockRejectedValue(new Error("Invalid API Key"));

    const view = await stripeStatusService.getForAdmin("admin");

    expect(view.account).toEqual({ reachable: false, error: "Invalid API Key" });
    expect(states(view.checks)).toMatchObject({ chargesEnabled: "fail", webhookEndpoint: "fail" });
  });

  it("fails the mock check loudly when MOCK_PAYMENTS is on", async () => {
    process.env.MOCK_PAYMENTS = "true";

    const view = await stripeStatusService.getForAdmin("admin");

    expect(view.mockPayments).toBe(true);
    expect(states(view.checks).mockOff).toBe("fail");
  });

  it("never returns a key", async () => {
    const view = await stripeStatusService.getForAdmin("admin");

    expect(JSON.stringify(view)).not.toContain("sk_live_abc");
    expect(JSON.stringify(view)).not.toContain("pk_live_abc");
  });
});
