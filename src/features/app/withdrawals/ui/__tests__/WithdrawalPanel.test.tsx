import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../../../../messages/en.json";
import fr from "../../../../../../messages/fr.json";
import type { WithdrawalBalance } from "../../api/withdrawals.api";

import { WithdrawalPanel } from "../WithdrawalPanel";

const balance: {
  data: WithdrawalBalance | undefined;
  isLoading: boolean;
  isError: boolean;
  isRefetching: boolean;
  refetch: () => void;
} = {
  data: undefined,
  isLoading: false,
  isError: false,
  isRefetching: false,
  refetch: vi.fn(),
};

vi.mock("../../hooks/useWithdrawals", () => ({
  useWithdrawalBalance: () => balance,
  useRequestWithdrawal: () => ({ mutate: vi.fn(), isPending: false }),
}));

const BALANCE: WithdrawalBalance = {
  availableCents: 24_000,
  deliveries: 2,
  minimumCents: 2_000,
  canRequest: true,
  openRequest: null,
  history: [],
  hasEverEarned: true,
  carrierStatus: "approved",
};

/** Nothing has ever landed: the state the empty screen is written for. */
const NOTHING: WithdrawalBalance = {
  ...BALANCE,
  availableCents: 0,
  deliveries: 0,
  canRequest: false,
  hasEverEarned: false,
};

function renderWith(locale: "en" | "fr" = "en", messages = en) {
  const onError = vi.fn<(error: Error) => void>();
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      onError={onError}
      timeZone="Europe/Paris"
    >
      <WithdrawalPanel />
    </NextIntlClientProvider>
  );
  return onError;
}

beforeEach(() => {
  balance.data = BALANCE;
  balance.isLoading = false;
  balance.isError = false;
  balance.isRefetching = false;
});

describe("WithdrawalPanel", () => {
  it.each([
    ["en", en],
    ["fr", fr],
  ] as const)("resolves every message key in %s", (locale, messages) => {
    const onError = renderWith(locale, messages);

    expect(onError.mock.calls.map(([e]) => e.message)).toEqual([]);
  });

  it("shows the balance and the request button", () => {
    renderWith();

    expect(screen.getByText("Available to withdraw")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Request a withdrawal" })
    ).toBeEnabled();
  });

  it.each([
    ["the endpoint fails", { isError: true, data: undefined }],
    ["the payload is missing", { isError: false, data: undefined }],
  ])("explains itself and offers a retry when %s", (_case, state) => {
    // This is the regression that mattered: the panel used to `return null`,
    // so a 500 from /api/carrier/withdrawals rendered a completely blank page
    // — no heading, no error, nothing to press. The only evidence was the
    // browser console.
    Object.assign(balance, state);

    renderWith();

    expect(screen.getByText("Earnings unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Try again/ })).toBeEnabled();
  });

  it("never renders an empty document on failure", () => {
    balance.isError = true;
    balance.data = undefined;

    const { container } = render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Europe/Paris">
        <WithdrawalPanel />
      </NextIntlClientProvider>
    );

    expect(container).not.toBeEmptyDOMElement();
  });

  it("translates the failure, so a French driver is not shown English", () => {
    balance.isError = true;
    balance.data = undefined;

    const onError = renderWith("fr", fr);

    expect(screen.getByText("Gains indisponibles")).toBeInTheDocument();
    expect(onError.mock.calls.map(([e]) => e.message)).toEqual([]);
  });

  it("disables the retry while it is already refetching", () => {
    balance.isError = true;
    balance.data = undefined;
    balance.isRefetching = true;

    renderWith();

    expect(screen.getByRole("button", { name: /Try again/ })).toBeDisabled();
  });
});

// ========================================
// Nothing earned yet
// ========================================

describe("WithdrawalPanel, with nothing earned", () => {
  it.each([
    ["en", en, "Aucun gain"],
    ["fr", fr, "Nothing earned"],
  ] as const)(
    "resolves every empty-state message key in %s",
    (locale, messages, otherLocale) => {
      balance.data = { ...NOTHING, carrierStatus: null };

      const onError = renderWith(locale, messages);

      expect(onError.mock.calls.map(([e]) => e.message)).toEqual([]);
      // A missing key renders as the key itself, which the parity check above
      // catches — this catches the other half: copy left in one language.
      expect(screen.queryByText(new RegExp(otherLocale))).toBeNull();
    }
  );

  it("sends an approved driver to the job board rather than a greyed-out button", () => {
    balance.data = NOTHING;

    renderWith();

    expect(screen.getByText("Nothing earned yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse jobs" })).toHaveAttribute(
      "href",
      "/expedion"
    );
    // The dead end this replaced.
    expect(screen.queryByText("Available to withdraw")).toBeNull();
    expect(screen.queryByRole("button", { name: /Request a withdrawal/ })).toBeNull();
  });

  it.each([
    [null, "Become a driver"],
    ["draft", "Finish my application"],
    ["submitted", "Check my application"],
    ["under_review", "Check my application"],
    ["rejected", "Open my application"],
    ["suspended", "Open my application"],
  ] as const)(
    "points a %s applicant at their application, not at a board they cannot bid on",
    (carrierStatus, cta) => {
      balance.data = { ...NOTHING, carrierStatus };

      renderWith();

      expect(screen.getByRole("link", { name: cta })).toHaveAttribute(
        "href",
        "/carrier/application"
      );
    }
  );

  it("shows the card, not the pitch, to a driver whose payouts are already claimed", () => {
    // `deliveries` counts unclaimed payouts only, so this driver reads as
    // €0.00 from no deliveries — but they have earned, and telling them
    // otherwise would be worse than the number.
    balance.data = {
      ...NOTHING,
      hasEverEarned: true,
      openRequest: {
        id: "wd-1",
        carrierId: "c-1",
        amountCents: 24_000,
        currency: "EUR",
        status: "requested",
        reference: null,
        decisionNote: null,
        createdAt: new Date("2026-08-01").toISOString(),
        decidedAt: null,
        paidAt: null,
      },
    };

    renderWith();

    expect(screen.getByText("Available to withdraw")).toBeInTheDocument();
    expect(screen.queryByText("Nothing earned yet")).toBeNull();
  });

  it("shows the card to a driver with a past withdrawal and no live payout", () => {
    balance.data = {
      ...NOTHING,
      history: [
        {
          id: "wd-0",
          carrierId: "c-1",
          amountCents: 24_000,
          currency: "EUR",
          status: "paid",
          reference: "VIR-2026-0001",
          decisionNote: null,
          createdAt: new Date("2026-07-01").toISOString(),
          decidedAt: new Date("2026-07-02").toISOString(),
          paidAt: new Date("2026-07-02").toISOString(),
        },
      ],
    };

    renderWith();

    expect(screen.getByText("Past withdrawals")).toBeInTheDocument();
    expect(screen.queryByText("Nothing earned yet")).toBeNull();
  });

  it("shows the failure, not the pitch, when the call broke", () => {
    // Order matters: an unreachable endpoint is not an empty balance, and a
    // driver with money must never be told they have never earned any.
    balance.isError = true;
    balance.data = undefined;

    renderWith();

    expect(screen.getByText("Earnings unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Nothing earned yet")).toBeNull();
  });
});
