import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Only the two chains the read paths use: db.query.user.findFirst, and the
// Stripe SDK calls that must NOT happen for a user with no customer.
const harness = vi.hoisted(() => {
  const userRow: { id: string; email: string; name: string; stripeCustomerId: string | null } | null =
    { id: "user-1", email: "u@x.test", name: "U", stripeCustomerId: null };

  return {
    state: { user: userRow as typeof userRow },
    customersCreate: vi.fn(),
    paymentMethodsList: vi.fn(),
    accountLinksCreate: vi.fn(),
  };
});

vi.mock("@/db", () => ({
  db: {
    query: { user: { findFirst: vi.fn(async () => harness.state.user) } },
    update: vi.fn(() => ({ set: () => ({ where: async () => undefined }) })),
  },
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    customers: { create: harness.customersCreate },
    paymentMethods: { list: harness.paymentMethodsList, retrieve: vi.fn(), detach: vi.fn() },
    setupIntents: { create: vi.fn() },
    accounts: { create: vi.fn(), retrieve: vi.fn() },
    accountLinks: { create: harness.accountLinksCreate },
  },
}));

vi.mock("drizzle-orm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("drizzle-orm")>()),
  eq: vi.fn(() => ({})),
}));

import { stripeService } from "../stripe.service";

describe("stripeService payment method reads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.state.user = { id: "user-1", email: "u@x.test", name: "U", stripeCustomerId: null };
  });

  it("returns no cards without creating a customer", async () => {
    const result = await stripeService.listPaymentMethods("user-1");

    expect(result).toEqual([]);
    // Reading a user's cards used to call getOrCreateCustomer, so merely
    // opening the payments page created a real Stripe customer and stamped
    // the id on their row -- a write performed by a GET.
    expect(harness.customersCreate).not.toHaveBeenCalled();
    expect(harness.paymentMethodsList).not.toHaveBeenCalled();
  });

  it("lists the cards of a user who already has a customer", async () => {
    harness.state.user = {
      id: "user-1", email: "u@x.test", name: "U", stripeCustomerId: "cus_123",
    };
    harness.paymentMethodsList.mockResolvedValue({ data: [{ id: "pm_1" }] });

    const result = await stripeService.listPaymentMethods("user-1");

    expect(result).toEqual([{ id: "pm_1" }]);
    expect(harness.paymentMethodsList).toHaveBeenCalledWith({
      customer: "cus_123",
      type: "card",
    });
    expect(harness.customersCreate).not.toHaveBeenCalled();
  });

  it("refuses to detach a card for a user with no customer", async () => {
    await expect(stripeService.detachPaymentMethod("user-1", "pm_1")).rejects.toThrow(
      "Unauthorized"
    );
  });
});

// docs/specs/payment_polish_2_99_3_spec.md §5: the onboarding link's two
// addresses used to fall back to http://localhost:3000, which Stripe would
// have accepted and a driver could not have reached.
describe("stripeService.createAccountLink — the addresses Stripe sends the driver back to", () => {
  const original = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => {
    harness.accountLinksCreate.mockResolvedValue({ url: "https://connect.stripe.com/setup/x" });
  });
  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = original;
  });

  it("names the production origin when the deployment sets none", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;

    await stripeService.createAccountLink("acct_1");

    expect(harness.accountLinksCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        refresh_url: "https://www.expeditop.fr/api/stripe/connect/refresh",
        return_url: "https://www.expeditop.fr/api/stripe/connect/return",
      })
    );
  });

  it("names the deployment's own origin when it sets one", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://dev.expeditop.fr";

    await stripeService.createAccountLink("acct_1");

    expect(harness.accountLinksCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        return_url: "https://dev.expeditop.fr/api/stripe/connect/return",
      })
    );
  });
});
