import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import en from "../../../../../../../messages/en.json";
import fr from "../../../../../../../messages/fr.json";
import type { QuoteRow } from "@/server/dal/expedion-report.dal";
import type { ExpedionReport } from "@/server/services/expedion-report.service";

import { ExpedionDashboard } from "../ExpedionDashboard";

/**
 * Renders the report against the real message catalogues.
 *
 * The page reaches for a lot of keys, several of them built by template
 * (`funnel.${status}`, `queues.${key}Empty`) so neither TypeScript nor a grep
 * can tell you they exist. next-intl does not throw on a missing key — it
 * renders the key path and calls `onError` — so a typo would ship as
 * `admin.expedion.funnel.picked_up` sitting visibly in the UI. Asserting
 * `onError` is never called is what catches that, and running it over both
 * catalogues is what keeps them honest with each other.
 */

const QUOTE: QuoteRow = {
  id: "5a8f2c1e-0000-4000-8000-000000000001",
  reference: "EXP-2026-0001",
  status: "pending",
  paymentStatus: "unpaid",
  auctionHouseName: "Drouot",
  deliveryCity: "Lyon",
  clientName: "A. Client",
  clientEmail: "client@example.com",
  priceCents: 12_000,
  standardCents: 12_000,
  insuredCents: 14_500,
  owned: true,
  hasPickupCoords: true,
  escalationReady: true,
  queues: {
    toPrice: true,
    needsDriver: false,
    storageAtRisk: true,
    escalationDue: false,
  },
  storageFreeUntil: new Date("2026-08-20T00:00:00Z"),
  escalateAfter: new Date("2026-08-18T00:00:00Z"),
  requestedAt: new Date("2026-08-14T00:00:00Z"),
};

/** An unowned row with no coordinates, so the fallback branches also render. */
const ORPHAN: QuoteRow = {
  ...QUOTE,
  id: "5a8f2c1e-0000-4000-8000-000000000002",
  reference: null,
  auctionHouseName: null,
  deliveryCity: null,
  clientName: null,
  clientEmail: null,
  priceCents: null,
  owned: false,
  hasPickupCoords: false,
  escalationReady: false,
  // Overdue *and* unescalatable, so the recent list renders its blocked
  // branch — the one where the button is offered but refuses to fire.
  queues: {
    toPrice: false,
    needsDriver: true,
    storageAtRisk: true,
    escalationDue: true,
  },
  // Already past, so the storage column takes its "billed" branch.
  storageFreeUntil: new Date("2026-08-01T00:00:00Z"),
};

const REPORT: ExpedionReport = {
  quotes: {
    total: 4591,
    unowned: 4450,
    awaitingPricing: 3,
    awaitingPayment: 2,
    needsDriver: 1,
    escalated: 7,
    assigned: 21,
    delivered: 15,
    cancelled: 4,
    storageAtRisk: 2,
    escalationDue: 1,
    acceptedValueCents: 980_000,
    paidValueCents: 640_000,
    insuredShare: 0.32,
  },
  // Every funnel stage present, so all nine `funnel.*` keys are exercised.
  statuses: [
    { status: "pending", count: 12 },
    { status: "awaiting_confirmation", count: 5 },
    { status: "quoted", count: 30 },
    { status: "accepted", count: 24 },
    { status: "paid", count: 18 },
    { status: "assigned", count: 21 },
    { status: "escalated", count: 7 },
    { status: "picked_up", count: 9 },
    { status: "delivered", count: 15 },
    { status: "cancelled", count: 4 },
  ],
  marketplace: {
    expedionListings: 7,
    directListings: 3,
    offersOnExpedionJobs: 11,
    expedionShipments: 6,
    deliveredShipments: 5,
    carriersApproved: 8,
    carriersPending: 2,
    activeVehicles: 13,
  },
  health: {
    unowned: 4450,
    missingPickupCoords: 41,
    missingDimensions: 120,
    meanExtractionConfidence: 0.87,
    extracted: 3200,
  },
  series: [
    { name: "mars", quotes: 40, acceptedCents: 120_000 },
    { name: "avril", quotes: 55, acceptedCents: 180_000 },
  ],
  queues: {
    toPrice: [QUOTE],
    needsDriver: [ORPHAN],
    storageAtRisk: [ORPHAN],
    escalationDue: [QUOTE],
  },
  recent: [QUOTE, ORPHAN],
  platform: {
    appFeesCents: 210_000,
    activeUsers: 320,
    activeDrivers: 18,
    pendingDeliveries: 6,
  },
  unavailable: [],
  provisional: {
    paymentsUnobserved: true,
    mockPayments: true,
    payoutsIncomplete: true,
  },
};

const state = vi.hoisted(() => ({
  report: undefined as ExpedionReport | undefined,
  isLoading: false,
  error: null as Error | null,
}));

vi.mock("../../hooks/useExpedionReport", () => ({
  useExpedionReport: () => ({
    data: state.report,
    isLoading: state.isLoading,
    error: state.error,
  }),
  useExpedionQuoteAdmin: () => ({ mutate: vi.fn(), isPending: false }),
  useExpedionEscalate: () => ({ mutate: vi.fn(), isPending: false }),
  useCarrierOptions: () => ({ data: [], isLoading: false }),
}));

// recharts measures its container, which jsdom reports as 0×0 and then warns
// about on every render. The chart's own correctness is not what this asserts.
vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 400, height: 250 }}>{children}</div>
    ),
  };
});

function renderWith(locale: "en" | "fr", messages: typeof en | typeof fr) {
  const onError = vi.fn<(error: Error) => void>();
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      onError={onError}
    >
      <ExpedionDashboard />
    </NextIntlClientProvider>
  );
  return onError;
}

describe("ExpedionDashboard", () => {
  it.each([
    ["fr", fr, "Supervision"],
    ["en", en, "Overview"],
  ] as const)("resolves every message key in %s", (locale, messages, title) => {
    state.report = REPORT;
    state.isLoading = false;
    state.error = null;

    const onError = renderWith(locale, messages);

    expect(
      onError.mock.calls.map(([e]) => e.message),
      "next-intl reported a message problem"
    ).toEqual([]);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(title);
  });

  it("renders the funnel, the queues and the health card", () => {
    state.report = REPORT;
    state.isLoading = false;
    state.error = null;

    renderWith("fr", fr);

    // A stage label proves the templated `funnel.${status}` lookups resolve
    // rather than falling through to the raw key path.
    expect(screen.getByText("Enlevés")).toBeInTheDocument();
    expect(screen.queryByText(/admin\.expedion\./)).toBeNull();

    // The interpolated hints, which are the other thing a bad key breaks.
    // "4.450" not "4 450": src/lib/currency.ts formats with de-DE, not fr-FR
    // (see its header comment for why).
    expect(screen.getByText("4.450 importés sans compte")).toBeInTheDocument();
    // The two caveats sit on the figures they actually qualify: "Collected"
    // counts only settlements Expedion reported to us, while the commission
    // total is what MOCK_PAYMENTS inflates. They used to be the other way round.
    expect(
      screen.getByText("*paiements déclarés, non constatés")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/\*avant frais Stripe \*paiements simulés/)
    ).toBeInTheDocument();

    // The queue tabs carry their pending counts.
    expect(
      screen.getByRole("tab", { name: /À chiffrer/ })
    ).toBeInTheDocument();
  });

  it("shows the empty state, translated, when a queue is clear", () => {
    state.report = {
      ...REPORT,
      queues: { ...REPORT.queues, toPrice: [] },
    };
    state.isLoading = false;
    state.error = null;

    renderWith("fr", fr);

    expect(screen.getByText("Rien à chiffrer")).toBeInTheDocument();
  });

  it("shows an unavailable section as unknown, not as nought", () => {
    // The figures are deliberately left at their real values. In production a
    // failed section arrives zero-filled, so asserting against zeros would pass
    // for a page that ignores `unavailable` entirely; keeping the numbers is
    // what proves the flag, and not the value, is what the page reads.
    state.report = {
      ...REPORT,
      queues: { ...REPORT.queues, toPrice: [] },
      unavailable: ["quotes", "queues"],
    };
    state.isLoading = false;
    state.error = null;

    const onError = renderWith("fr", fr);

    expect(
      onError.mock.calls.map(([e]) => e.message),
      "next-intl reported a message problem"
    ).toEqual([]);
    // The quote total, which the report no longer vouches for.
    expect(screen.queryByText(/^4.591$/)).toBeNull();
    // An unread queue must not report the work as done.
    expect(screen.queryByText("Rien à chiffrer")).toBeNull();
    expect(screen.getByText("Rapport indisponible")).toBeInTheDocument();
  });

  it("falls back to the translated error when the report fails", () => {
    state.report = undefined;
    state.isLoading = false;
    // An error with no message, so the `?? t("error")` branch is the one taken.
    state.error = new Error("");

    renderWith("fr", fr);

    expect(screen.getByText("Rapport indisponible")).toBeInTheDocument();
  });
});
