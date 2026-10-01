import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import fr from "../../../../../../messages/fr.json";
import { ApiError } from "@/lib/fetcher";
import { offersApi, type PaymentQuote } from "../../api/offers.api";

/**
 * Radix needs a browser API jsdom does not ship (its radio group measures
 * itself). Polyfilled here rather than in `src/testing/setup-vitest.ts`, the
 * way `ReportIncidentDialog.test.tsx` does, so no other suite inherits it.
 */
class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= NoopResizeObserver as never;

// Stripe itself is stood in for: what is pinned here is what the dialog says
// and offers once the accept call has answered, or has not
// (docs/specs/pay_at_accept_spec.md §3.5). The real form is verified in
// Chromium against Stripe test mode.
vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PaymentElement: () => <div data-testid="card-form" />,
  useStripe: () => ({}),
  useElements: () => ({}),
}));
vi.mock("@/lib/stripe-client", () => ({ getStripe: () => Promise.resolve({}) }));
vi.mock("@/components/ui/lottie-loader", () => ({ LottieLoader: () => null }));

import { AcceptPaymentDialog } from "../AcceptPaymentDialog";

const t = fr.acceptPayment;

const quote = (over: Partial<PaymentQuote> = {}): PaymentQuote => ({
  required: true,
  reason: "charge",
  priceCents: 18_000,
  platformFeeCents: 1_800,
  totalCents: 19_800,
  savedCard: { brand: "visa", last4: "4242" },
  ...over,
});

const onOpenChange = vi.fn();

function renderDialog(onConfirm: (intentId?: string) => Promise<unknown>) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidate = vi.spyOn(client, "invalidateQueries");

  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="fr" messages={fr}>
        <AcceptPaymentDialog
          offerId="offer-1"
          open
          onOpenChange={onOpenChange}
          onConfirm={onConfirm}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
  return { invalidate };
}

/** The Pay button of a quote that charges 198,00 €. */
const payButton = () => screen.findByRole("button", { name: /^Payer .* et accepter$/ });

beforeEach(() => {
  vi.restoreAllMocks();
  onOpenChange.mockClear();
  vi.spyOn(offersApi, "preparePayment").mockResolvedValue({
    paymentIntentId: "pi_1",
    status: "requires_capture",
    clientSecret: "pi_1_secret",
  });
});

describe("AcceptPaymentDialog — a job that is paid here", () => {
  beforeEach(() => {
    vi.spyOn(offersApi, "paymentQuote").mockResolvedValue(quote());
  });

  it("shows the fee and the total before anything is paid", async () => {
    renderDialog(vi.fn());
    await payButton();

    expect(screen.getByText(t.fee)).toBeTruthy();
    expect(screen.getByText(t.total)).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Visa •••• 4242" })).toBeTruthy();
    // The card form is for "another card"; a saved one needs none.
    expect(screen.queryByTestId("card-form")).toBeNull();
  });

  it("pays with the saved card and hands the authorised intent to the accept", async () => {
    const onConfirm = vi.fn().mockResolvedValue({});
    renderDialog(onConfirm);

    fireEvent.click(await payButton());

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith("pi_1"));
    expect(offersApi.preparePayment).toHaveBeenCalledWith("offer-1", {
      method: "saved",
      slotId: undefined,
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("says the card was not debited only when the server refused the award", async () => {
    renderDialog(
      vi.fn().mockRejectedValue(new ApiError("OFFER_NOT_PENDING", "", 409))
    );

    fireEvent.click(await payButton());

    expect(await screen.findByText(t.acceptFailed)).toBeTruthy();
    // A refusal changed nothing, so paying again is still on offer.
    expect(await payButton()).toBeTruthy();
  });

  it.each([
    ["the connection dropped", new TypeError("Failed to fetch")],
    ["the function timed out", new ApiError("INVALID_RESPONSE", "", 504)],
    ["the server failed after the capture", new ApiError("UNKNOWN", "", 500)],
  ])("does not guess when %s", async (_label, failure) => {
    const { invalidate } = renderDialog(vi.fn().mockRejectedValue(failure));

    fireEvent.click(await payButton());

    expect(await screen.findByText(t.acceptUnknownPaid)).toBeTruthy();
    expect(screen.queryByText(t.acceptFailed)).toBeNull();
    // The card may have been debited: no second Pay, and the page behind is
    // refetched so the requester can see what actually happened.
    expect(screen.queryByRole("button", { name: /^Payer/ })).toBeNull();
    expect(screen.getByRole("button", { name: t.close })).toBeTruthy();
    expect(invalidate).toHaveBeenCalled();
  });

  it("offers the card form when the bank declines the saved card", async () => {
    vi.spyOn(offersApi, "preparePayment").mockRejectedValue(
      new ApiError("PAYMENT_DECLINED", "", 402)
    );
    const onConfirm = vi.fn();
    renderDialog(onConfirm);

    fireEvent.click(await payButton());

    expect(await screen.findByText(t.errors.PAYMENT_DECLINED)).toBeTruthy();
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("radio", { name: t.otherCard }));
    expect(screen.getByTestId("card-form")).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: t.saveCard })).toHaveProperty(
      "ariaChecked",
      "false"
    );
  });
});

describe("AcceptPaymentDialog — a job nothing is paid for here", () => {
  it("confirms an escalated job without naming any intent", async () => {
    vi.spyOn(offersApi, "paymentQuote").mockResolvedValue(
      quote({ required: false, reason: "prepaid", platformFeeCents: 0, totalCents: 18_000, savedCard: null })
    );
    const onConfirm = vi.fn().mockResolvedValue({});
    renderDialog(onConfirm);

    expect(await screen.findByText(t.prepaid)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: t.confirm }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith());
    expect(offersApi.preparePayment).not.toHaveBeenCalled();
  });

  it("calls a test-mode total what it is", async () => {
    vi.spyOn(offersApi, "paymentQuote").mockResolvedValue(
      quote({ required: false, reason: "mock", savedCard: null })
    );
    renderDialog(vi.fn());

    expect(await screen.findByText(t.mock)).toBeTruthy();
    expect(screen.getByText(t.totalNotCharged)).toBeTruthy();
    expect(screen.queryByText(t.offerAmount)).toBeNull();
  });

  it("never mentions a card when a refusal involved none", async () => {
    vi.spyOn(offersApi, "paymentQuote").mockResolvedValue(
      quote({ required: false, reason: "prepaid", platformFeeCents: 0, totalCents: 18_000, savedCard: null })
    );
    renderDialog(
      vi.fn().mockRejectedValue(new ApiError("LISTING_NOT_OPEN", "", 409))
    );

    fireEvent.click(await screen.findByRole("button", { name: t.confirm }));

    expect(await screen.findByText(t.acceptRefused)).toBeTruthy();
    expect(screen.queryByText(t.acceptFailed)).toBeNull();
  });
});

describe("AcceptPaymentDialog — a quote that cannot be given", () => {
  it("says in words why the offer cannot be accepted, before any card is asked for", async () => {
    vi.spyOn(offersApi, "paymentQuote").mockRejectedValue(
      new ApiError("COORDINATES_REQUIRED", "COORDINATES_REQUIRED", 422)
    );
    renderDialog(vi.fn());

    expect(await screen.findByText(t.errors.COORDINATES_REQUIRED)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Payer/ })).toBeNull();
    expect(screen.getByRole("button", { name: t.close })).toBeTruthy();
  });
});
