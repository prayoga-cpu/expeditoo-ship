import { render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import en from "../../../../../messages/en.json";
import fr from "../../../../../messages/fr.json";

/**
 * The card step on `/create` (docs/specs/payment_at_booking_spec.md §7).
 *
 * Stripe Elements is stubbed rather than driven: what matters here is which of
 * the three states the step lands in, and — the load-bearing part — whether it
 * reports a usable card upward, because that is what decides whether the job
 * can go on the board at all.
 */
vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="stripe-elements">{children}</div>
  ),
  PaymentElement: () => <div data-testid="payment-element" />,
  useStripe: () => ({ confirmSetup: vi.fn() }),
  useElements: () => ({}),
}));
vi.mock("@/lib/stripe-client", () => ({ getStripe: () => ({}) }));
vi.mock("@/lib/stripe-appearance", () => ({ getStripeAppearance: () => ({}) }));
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }));
vi.mock("@/components/ui/lottie-loader", () => ({
  LottieLoader: () => <div data-testid="loader" />,
}));

import { PaymentStep } from "../ui/PaymentStep";

const onError = vi.fn();

/** Answers the two calls the step makes on mount. */
function givenCards(cards: unknown[], setupIntent = "seti_secret") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: { method?: string }) => {
      if (String(url).includes("payment-methods")) {
        return { json: async () => cards } as Response;
      }
      if (String(url).includes("setup-intent") && init?.method === "POST") {
        return { json: async () => ({ clientSecret: setupIntent }) } as Response;
      }
      throw new Error(`unexpected fetch: ${url}`);
    })
  );
}

const renderStep = (onCardChange = vi.fn(), messages: typeof en = en) => {
  render(
    <NextIntlClientProvider locale="en" messages={messages} onError={onError}>
      <PaymentStep onCardChange={onCardChange} />
    </NextIntlClientProvider>
  );
  return onCardChange;
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PaymentStep", () => {
  it("shows the card a posted job will be charged to", async () => {
    givenCards([{ id: "pm_1", card: { brand: "visa", last4: "4242" } }]);

    renderStep();

    expect(await screen.findByText(/visa •••• 4242/i)).toBeInTheDocument();
    expect(screen.queryByTestId("payment-element")).not.toBeInTheDocument();
  });

  it("reports the card upward, which is what unlocks posting", async () => {
    givenCards([{ id: "pm_1", card: { brand: "visa", last4: "4242" } }]);

    const onCardChange = renderStep();

    await waitFor(() => expect(onCardChange).toHaveBeenCalledWith(true));
  });

  it("never opens a SetupIntent for someone who already has a card", async () => {
    // A live intent per visit, for a person only passing through the step.
    givenCards([{ id: "pm_1", card: { brand: "visa", last4: "4242" } }]);

    renderStep();

    await waitFor(() => expect(screen.getByText(/visa/i)).toBeInTheDocument());
    const calls = vi.mocked(globalThis.fetch).mock.calls.map((c) => String(c[0]));
    expect(calls.some((url) => url.includes("setup-intent"))).toBe(false);
  });

  it("collects a card when there is none", async () => {
    givenCards([]);

    const onCardChange = renderStep();

    expect(await screen.findByTestId("payment-element")).toBeInTheDocument();
    await waitFor(() => expect(onCardChange).toHaveBeenCalledWith(false));
  });

  it("says the money is not being taken yet", async () => {
    // The amount is the winning offer, which does not exist while carriers
    // have not bid. The step collects permission to charge, not a payment.
    givenCards([]);

    renderStep();

    expect(
      await screen.findByText(en.create.payment.description)
    ).toBeInTheDocument();
  });

  it("reports no card when the lookup fails, rather than guessing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("offline");
    }));

    const onCardChange = renderStep();

    await waitFor(() => expect(onCardChange).toHaveBeenCalledWith(false));
  });

  it("renders in French with no missing key", async () => {
    givenCards([{ id: "pm_1", card: { brand: "visa", last4: "4242" } }]);

    renderStep(vi.fn(), fr as typeof en);

    await screen.findByText(/visa •••• 4242/i);
    expect(onError).not.toHaveBeenCalled();
  });
});
