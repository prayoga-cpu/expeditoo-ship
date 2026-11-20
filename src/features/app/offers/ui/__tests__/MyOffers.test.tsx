import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import fr from "../../../../../../messages/fr.json";
import { ApiError } from "@/lib/fetcher";
import type { Offer } from "@/features/app/listing/types";

const mine = vi.hoisted(() => vi.fn());
vi.mock("../../api/offers.api", () => ({ offersApi: { mine, withdraw: vi.fn() } }));
vi.mock("@/components/ui/page-loader", () => ({ PageLoader: () => null }));

import { MyOffers } from "../MyOffers";

const M = fr.listing.bid.myOffers;
const show = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <NextIntlClientProvider locale="fr" messages={fr}>
        <MyOffers />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );

describe("MyOffers — a failed read", () => {
  it("explains a refusal and leads to the application, with no retry", async () => {
    mine.mockRejectedValue(new ApiError("FORBIDDEN_NOT_CARRIER", "no", 403));
    show();

    expect(await screen.findByText(M.notCarrier)).toBeTruthy();
    expect(screen.getByRole("link", { name: M.application }).getAttribute("href")).toBe("/carrier/application");
    expect(screen.queryByRole("button", { name: fr.common.loadError.retry })).toBeNull();
  });

  it("still offers a retry when the server failed", async () => {
    mine.mockRejectedValue(new ApiError("INTERNAL", "boom", 500));
    show();

    expect(await screen.findByRole("button", { name: fr.common.loadError.retry })).toBeTruthy();
  });
});

// 2.91.0 #24: a bid showed its status, its price and the driver's own slot —
// and nothing of the job it was placed on.
const OFFER: Offer = {
  id: "offer_1",
  listingId: "job_1",
  listing: {
    id: "job_1",
    reference: 100042,
    title: "Armoire normande",
    status: "open",
    pickupCity: "Lille",
    pickupPostalCode: "59000",
    pickupCountry: "FR",
    dropoffCity: "Bruxelles",
    dropoffPostalCode: "1000",
    dropoffCountry: "BE",
    pickupFrom: "2026-10-05T10:00:00.000Z",
    pickupUntil: "2026-10-07T10:00:00.000Z",
    dropoffFrom: "2026-10-08T10:00:00.000Z",
    dropoffUntil: "2026-10-09T10:00:00.000Z",
  },
  priceCents: 18_000,
  estimatedPickup: "2026-10-06T10:00:00.000Z",
  estimatedDelivery: "2026-10-08T20:00:00.000Z",
  deliveryLeadDays: 2,
  slots: [],
  message: null,
  status: "pending",
  createdAt: "2026-10-01T10:00:00.000Z",
  carrier: { id: "c1", name: "Paul", image: null, rating: 0 },
  vehicle: { id: "v1", type: "van", make: null, model: null, maxWeightKg: 800 },
  proposedAt: null,
  counterPriceCents: null,
  counterNote: null,
  counteredAt: null,
  counterRounds: 0,
};

describe("MyOffers — what each bid is on", () => {
  it("names the job: title, reference, both towns and the dates asked for", async () => {
    mine.mockResolvedValue([OFFER]);
    show();

    const card = await screen.findByTestId("my-offer");
    const text = card.textContent ?? "";

    expect(text).toContain("Armoire normande");
    expect(text).toContain("Réf. 100042");
    // The country is named when it is not France, and only then.
    expect(text).toContain("Lille → Bruxelles (Belgique)");
    expect(text).not.toContain("Lille (France)");
    // The requester's dates and the driver's own slot, labelled apart.
    expect(text).toContain(M.jobDates);
    expect(text).toMatch(/enlèvement 5\s?[–-]\s?7 oct\./);
    expect(text).toMatch(/livraison 8\s?[–-]\s?9 oct\./);
    expect(text).toContain(M.yourSlot);
    expect(text).toMatch(/enlèvement 6 oct\./);
    expect(text).toContain("180,00");
  });

  it("keeps its buttons", async () => {
    mine.mockResolvedValue([OFFER]);
    show();

    const card = await screen.findByTestId("my-offer");
    expect(within(card).getByRole("link", { name: M.viewJob }).getAttribute("href")).toBe("/listing/job_1");
    expect(within(card).getByRole("button", { name: M.withdraw })).toBeTruthy();
  });

  it.each([null, undefined])("still shows a bid whose job no longer resolves (%s)", async (listing) => {
    mine.mockResolvedValue([{ ...OFFER, listing, status: "expired" }]);
    show();

    const card = await screen.findByTestId("my-offer");
    expect(card.textContent).toContain(M.jobUnavailable);
    expect(card.textContent).toContain("180,00");
    expect(card.textContent).toContain(M.status.expired);
    // Gone or not, the next step is the board.
    expect(within(card).getByRole("link", { name: M.findAnother }).getAttribute("href")).toBe("/expedion");
  });
});
