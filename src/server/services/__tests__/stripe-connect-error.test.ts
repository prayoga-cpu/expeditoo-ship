import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Stripe from "stripe";

/**
 * Payout onboarding, and what happens when Stripe says no.
 *
 * The button was dead on production: Stripe answered 400 — the platform
 * account had been restricted from opening connected accounts — and the
 * service let a bare rejection through, which the route reported as a 500
 * carrying Stripe's own wording. What is covered here is the translation:
 * which failures become a typed 4xx, which stay genuinely unexpected, and
 * that Stripe's prose never travels with either.
 */

type UserRow = {
  id: string;
  email: string;
  name: string;
  stripeAccountId: string | null;
} | null;

const harness = vi.hoisted(() => ({
  state: {
    user: {
      id: "user-1",
      email: "u@x.test",
      name: "U",
      stripeAccountId: null,
    } as UserRow,
  },
  accountsCreate: vi.fn(),
  accountLinksCreate: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    query: { user: { findFirst: vi.fn(async () => harness.state.user) } },
    update: vi.fn(() => ({ set: () => ({ where: async () => undefined }) })),
  },
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    customers: { create: vi.fn() },
    paymentMethods: { list: vi.fn(), retrieve: vi.fn(), detach: vi.fn() },
    setupIntents: { create: vi.fn() },
    accounts: { create: harness.accountsCreate, retrieve: vi.fn() },
    accountLinks: { create: harness.accountLinksCreate },
  },
}));

vi.mock("drizzle-orm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("drizzle-orm")>()),
  eq: vi.fn(() => ({})),
}));

import { stripeService, StripeConnectError } from "../stripe.service";

/** The production failure, built with the SDK's own class rather than a stub. */
const RESTRICTION_PROSE =
  "We've temporarily restricted your ability to create this type of connected account due to suspicious activity.";

const restriction = () =>
  Stripe.errors.generate({
    type: "invalid_request_error",
    message: RESTRICTION_PROSE,
    statusCode: 400,
  });

let logged: unknown[][];

beforeEach(() => {
  vi.clearAllMocks();
  harness.state.user = {
    id: "user-1",
    email: "u@x.test",
    name: "U",
    stripeAccountId: null,
  };
  logged = [];
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    logged.push(args);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createConnectAccount", () => {
  it("still creates the Express account and returns its id", async () => {
    harness.accountsCreate.mockResolvedValue({ id: "acct_123" });

    await expect(stripeService.createConnectAccount("user-1")).resolves.toBe(
      "acct_123"
    );
    expect(harness.accountsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ type: "express", email: "u@x.test" })
    );
  });

  it("reuses an account the user already has, calling Stripe not at all", async () => {
    harness.state.user = {
      id: "user-1",
      email: "u@x.test",
      name: "U",
      stripeAccountId: "acct_existing",
    };

    await expect(stripeService.createConnectAccount("user-1")).resolves.toBe(
      "acct_existing"
    );
    expect(harness.accountsCreate).not.toHaveBeenCalled();
  });

  it("turns Stripe's refusal into a typed 4xx, not a server failure", async () => {
    harness.accountsCreate.mockRejectedValue(restriction());

    const error = await stripeService
      .createConnectAccount("user-1")
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(StripeConnectError);
    const typed = error as StripeConnectError;
    expect(typed.code).toBe("STRIPE_REQUEST_REJECTED");
    // 400 from Stripe is Stripe refusing us, not this server breaking.
    expect(typed.status).toBe(422);
  });

  it("keeps Stripe's own wording in the log and out of the thrown error", async () => {
    harness.accountsCreate.mockRejectedValue(restriction());

    const error = await stripeService
      .createConnectAccount("user-1")
      .catch((e: unknown) => e);

    // The prose names the *platform's* account and is written for whoever
    // reads the Stripe dashboard. It must not reach a driver's browser.
    expect((error as Error).message).not.toContain("restricted");
    expect(JSON.stringify(logged)).toContain(RESTRICTION_PROSE);
  });

  it("leaves a genuinely unexpected failure unexpected", async () => {
    const outage = new Error("socket hang up");
    harness.accountsCreate.mockRejectedValue(outage);

    const error = await stripeService
      .createConnectAccount("user-1")
      .catch((e: unknown) => e);

    // Untranslated on purpose: handleError answers 500 for this, which is what
    // a network fault or a bug of ours actually is.
    expect(error).toBe(outage);
    expect(error).not.toBeInstanceOf(StripeConnectError);
  });

  it("answers 404 for a user who does not exist", async () => {
    harness.state.user = null;

    const error = await stripeService
      .createConnectAccount("ghost")
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(StripeConnectError);
    expect((error as StripeConnectError).code).toBe("USER_NOT_FOUND");
    expect((error as StripeConnectError).status).toBe(404);
  });
});

describe("createAccountLink", () => {
  it("still mints the onboarding link", async () => {
    harness.accountLinksCreate.mockResolvedValue({
      url: "https://connect.stripe.com/setup/acct_123",
    });

    await expect(stripeService.createAccountLink("acct_123")).resolves.toBe(
      "https://connect.stripe.com/setup/acct_123"
    );
  });

  it("translates a refusal on the link the same way", async () => {
    harness.accountLinksCreate.mockRejectedValue(restriction());

    const error = await stripeService
      .createAccountLink("acct_123")
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(StripeConnectError);
    expect((error as StripeConnectError).status).toBe(422);
  });
});
