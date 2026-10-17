import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../../../../messages/en.json";
import fr from "../../../../../../messages/fr.json";
import { ApiError } from "@/lib/fetcher";
import type { CompanyIdentity, StripeStatus } from "../../api/platform-settings.api";

const company = {
  data: undefined as CompanyIdentity | undefined,
  isLoading: false,
  isError: false,
  isRefetching: false,
  refetch: vi.fn(),
};
const stripe = {
  data: undefined as StripeStatus | undefined,
  isLoading: false,
  isError: false,
  isFetching: false,
  refetch: vi.fn(),
};
const mutate = vi.fn();

vi.mock("../../hooks/useLaunchReadiness", () => ({
  useCompanyIdentity: () => company,
  useUpdateCompanyIdentity: () => ({ mutate, isPending: false }),
  useStripeStatus: () => stripe,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { CompanyIdentityPanel, DEFAULT_HOST } from "../CompanyIdentityPanel";
import { StripeStatusPanel } from "../StripeStatusPanel";

const EMPTY: CompanyIdentity = {
  values: {
    legalName: null,
    legalForm: null,
    capital: null,
    address: null,
    siret: null,
    rcs: null,
    vatNumber: null,
    vatRate: "0",
    billingEmail: null,
    publicationDirector: null,
    host: null,
  },
  documentType: "receipt",
  missing: ["legalName", "legalForm", "address", "siret", "rcs"],
  updatedAt: null,
};

const STATUS: StripeStatus = {
  secretKeyMode: "live",
  publishableKeyMode: "live",
  mockPayments: false,
  account: {
    reachable: true,
    id: "acct_1",
    name: "ATOUT GLOBAL SERVICES",
    chargesEnabled: true,
    payoutsEnabled: true,
    detailsSubmitted: true,
  },
  webhooks: {
    reachable: true,
    endpoints: [
      {
        url: "https://expeditoo-ship-five.vercel.app/api/stripe/webhook",
        status: "enabled",
        kind: "thisApp",
        coversHandledEvents: true,
      },
      {
        url: "https://expeditoo-rho.vercel.app/api/stripe/webhook",
        status: "enabled",
        kind: "thisPathOtherHost",
        coversHandledEvents: true,
      },
      {
        url: "https://agsexp.app.n8n.cloud/webhook/stripe",
        status: "enabled",
        kind: "other",
        coversHandledEvents: false,
      },
    ],
  },
  lastEvent: null,
  payments: { realCount: 0, firstRealAt: null, lastRealAt: null, mockCount: 3 },
  checks: [
    { key: "liveKeys", state: "ok" },
    { key: "mockOff", state: "ok" },
    { key: "chargesEnabled", state: "ok" },
    { key: "webhookEndpoint", state: "ok" },
    { key: "webhookReceived", state: "todo" },
    { key: "firstRealPayment", state: "todo" },
  ],
};

function renderWith(node: React.ReactNode, locale: "en" | "fr" = "en", messages = en) {
  const onError = vi.fn<(error: Error) => void>();
  render(
    <NextIntlClientProvider locale={locale} messages={messages} onError={onError} timeZone="Europe/Paris">
      {node}
    </NextIntlClientProvider>
  );
  return onError;
}

beforeEach(() => {
  vi.clearAllMocks();
  company.data = EMPTY;
  company.isError = false;
  stripe.data = STATUS;
  stripe.isError = false;
});

describe("CompanyIdentityPanel", () => {
  it.each([
    ["en", en],
    ["fr", fr],
  ] as const)("resolves every message key in %s", (locale, messages) => {
    const onError = renderWith(<CompanyIdentityPanel />, locale, messages);
    expect(onError.mock.calls.map(([e]) => e.message)).toEqual([]);
  });

  it("names what still keeps the documents from being invoices", () => {
    renderWith(<CompanyIdentityPanel />);
    expect(screen.getByText(/Missing: Legal name, Legal form, Registered office, SIRET, RCS registration\./)).toBeTruthy();
  });

  it("offers this deployment's host for an empty host field, and keeps saved values", () => {
    renderWith(<CompanyIdentityPanel />);
    expect((screen.getByLabelText("Hosting provider") as HTMLTextAreaElement).value).toBe(DEFAULT_HOST);
    expect((screen.getByLabelText("VAT rate (%)") as HTMLInputElement).value).toBe("0");
  });

  it("shows a server refusal under the field it names", () => {
    mutate.mockImplementation((_input, options) =>
      options.onError(
        new ApiError("VALIDATION_ERROR", "Invalid input", 400, [
          { path: "siret", message: "SIRET_14_DIGITS" },
        ])
      )
    );
    renderWith(<CompanyIdentityPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("A SIRET has 14 digits.")).toBeTruthy();
  });

  it("offers a retry rather than an empty form when the read fails", () => {
    company.data = undefined;
    company.isError = true;
    renderWith(<CompanyIdentityPanel />);
    expect(screen.getByText("Could not load the company details.")).toBeTruthy();
    expect(screen.queryByLabelText("SIRET")).toBeNull();
  });
});

describe("StripeStatusPanel", () => {
  it.each([
    ["en", en],
    ["fr", fr],
  ] as const)("resolves every message key in %s", (locale, messages) => {
    const onError = renderWith(<StripeStatusPanel />, locale, messages);
    expect(onError.mock.calls.map(([e]) => e.message)).toEqual([]);
  });

  it("says what was seen for each check, and lists the endpoints that are not this app's", () => {
    renderWith(<StripeStatusPanel />);

    expect(screen.getByText("Secret key: live · publishable key: live")).toBeTruthy();
    expect(screen.getByText("ATOUT GLOBAL SERVICES")).toBeTruthy();
    expect(screen.getByText(/None yet\. Accept an offer with a real card/)).toBeTruthy();
    expect(screen.getByText("https://agsexp.app.n8n.cloud/webhook/stripe")).toBeTruthy();
    expect(screen.getByText("This app’s path on another address: an old URL?")).toBeTruthy();
  });

  it("offers a retry when the check cannot be read", () => {
    stripe.data = undefined;
    stripe.isError = true;
    renderWith(<StripeStatusPanel />);
    expect(screen.getByText("Could not check Stripe.")).toBeTruthy();
  });
});
