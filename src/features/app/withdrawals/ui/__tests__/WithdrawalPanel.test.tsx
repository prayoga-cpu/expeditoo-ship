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
