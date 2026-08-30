import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../../../../messages/en.json";
import fr from "../../../../../../messages/fr.json";
import type { Job, JobDelivery } from "../../types";

import { DeliveryHistoryPanel } from "../DeliveryHistoryPanel";
import { MyRequestsScreen } from "../MyRequestsScreen";

/**
 * The history tab, against the real message catalogues, in both locales.
 *
 * `myJobs.status.*` and the plural in `myJobs.history.count` are reached by
 * template, so neither TypeScript nor a grep proves they exist. next-intl does
 * not throw on a missing key — it renders the key path and calls `onError` —
 * so asserting `onError` was never called is what turns a typo into a failing
 * test rather than `myJobs.history.count` sitting on the page.
 */

const history: {
  deliveries: { job: Job; delivery: JobDelivery }[];
  isLoading: boolean;
  isError: boolean;
} = { deliveries: [], isLoading: false, isError: false };

vi.mock("../../hooks/useMyRequests", () => ({
  useDeliveryHistory: () => history,
  useMyRequests: () => ({ data: [], isLoading: false, isError: false }),
}));

const searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => searchParams,
}));

const job = (over: Partial<Job> = {}) =>
  ({
    id: "job-1",
    title: "Pallet to Marseille",
    origin: "direct",
    status: "completed",
    pickupCity: "Lyon",
    dropoffCity: "Marseille",
    budgetCents: 12_000,
    offersCount: 3,
    createdAt: "2026-08-10T08:00:00.000Z",
    ...over,
  }) as Job;

const delivery = (over: Partial<JobDelivery> = {}): JobDelivery => ({
  shipmentId: "ship-1",
  deliveredAt: "2026-08-20T09:00:00.000Z",
  priceCents: 11_500,
  hasProofOfDelivery: true,
  carrier: { id: "carrier-1", name: "Jean Dupont", image: null, rating: 4.5 },
  ...over,
});

function renderPanel(locale: "en" | "fr" = "en", messages = en) {
  const onError = vi.fn<(error: Error) => void>();
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      onError={onError}
      timeZone="Europe/Paris"
    >
      <DeliveryHistoryPanel />
    </NextIntlClientProvider>
  );
  return onError;
}

beforeEach(() => {
  history.deliveries = [{ job: job(), delivery: delivery() }];
  history.isLoading = false;
  history.isError = false;
  searchParams.delete("tab");
});

describe("DeliveryHistoryPanel", () => {
  // The whole point of the feature: a delivery the requester received, with
  // the name of whoever drove it.
  it("names the transporter on a delivered request", () => {
    renderPanel();

    expect(screen.getByText("Jean Dupont")).toBeInTheDocument();
    expect(screen.getByText("Pallet to Marseille")).toBeInTheDocument();
    expect(screen.getByText("4.5")).toBeInTheDocument();
  });

  it("links the delivery to its shipment, where the photos and the review are", () => {
    renderPanel();

    expect(
      screen.getByRole("link", { name: "Pallet to Marseille" })
    ).toHaveAttribute("href", "/deliveries/ship-1");
  });

  // A delivery that happened is history whether or not the account behind it
  // still resolves — dropping the row would lose the record entirely.
  it("keeps a delivery whose carrier no longer resolves, and labels it", () => {
    history.deliveries = [{ job: job(), delivery: delivery({ carrier: null }) }];
    renderPanel();

    expect(
      screen.getByText(en.myJobs.history.unknownCarrier)
    ).toBeInTheDocument();
    expect(screen.getByText("Pallet to Marseille")).toBeInTheDocument();
  });

  it("marks a delivery that carries photos", () => {
    renderPanel();

    expect(screen.getByText(en.myJobs.history.proof)).toBeInTheDocument();
  });

  it("omits the marker when the driver left no photo", () => {
    history.deliveries = [
      { job: job(), delivery: delivery({ hasProofOfDelivery: false }) },
    ];
    renderPanel();

    expect(screen.queryByText(en.myJobs.history.proof)).not.toBeInTheDocument();
  });

  it("reads as empty, not as a failure, when nothing has been delivered", () => {
    history.deliveries = [];
    renderPanel();

    expect(screen.getByText(en.myJobs.history.empty)).toBeInTheDocument();
    expect(
      screen.queryByText(en.myJobs.history.loadFailed)
    ).not.toBeInTheDocument();
  });

  // A query hook that renders nothing on failure is how the withdrawals 500
  // stayed invisible for a week (CLAUDE.md gotcha 9).
  it("shows the failure rather than a blank page", () => {
    history.isError = true;
    renderPanel();

    expect(screen.getByText(en.myJobs.history.loadFailed)).toBeInTheDocument();
  });

  it("renders in both locales with no missing key", () => {
    expect(renderPanel("en", en)).not.toHaveBeenCalled();
    expect(renderPanel("fr", fr)).not.toHaveBeenCalled();
  });
});

describe("MyRequestsScreen", () => {
  const renderScreen = (locale: "en" | "fr" = "en", messages = en) => {
    const onError = vi.fn<(error: Error) => void>();
    render(
      <NextIntlClientProvider
        locale={locale}
        messages={messages}
        onError={onError}
        timeZone="Europe/Paris"
      >
        <MyRequestsScreen />
      </NextIntlClientProvider>
    );
    return onError;
  };

  it("opens on the requests tab when the URL names none", () => {
    renderScreen();

    expect(screen.getByRole("tab", { name: en.myJobs.tabs.requests })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  // The tab lives in the URL so a reload and a shared link land in the same
  // place — the reason it is not component state.
  it("opens the history when the URL asks for it", () => {
    searchParams.set("tab", "history");
    renderScreen();

    expect(screen.getByRole("tab", { name: en.myJobs.tabs.history })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByText("Jean Dupont")).toBeInTheDocument();
  });

  it("labels both tabs in French too", () => {
    const onError = renderScreen("fr", fr);

    expect(
      screen.getByRole("tab", { name: fr.myJobs.tabs.history })
    ).toBeInTheDocument();
    expect(onError).not.toHaveBeenCalled();
  });
});
