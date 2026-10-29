import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../../../../messages/en.json";
import fr from "../../../../../../messages/fr.json";
import { ApiError } from "@/lib/fetcher";
import { formatCurrency } from "@/lib/currency";
import type { PendingOffer } from "../../hooks/useCarrierTrips";

/** The amount as Testing Library reads it: its no-break space collapsed. */
const euros = (cents: number) => formatCurrency(cents).replace(/\s/g, " ");

/**
 * « En attente de réponse » (client_feedback_2026_10_spec.md §5): the real
 * panel and hooks against a stubbed client API, so what is asserted is what
 * the carrier would see and which endpoint a tap reaches.
 */

const api = vi.hoisted(() => ({
  mine: vi.fn(),
  withdraw: vi.fn(),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("@/features/app/offers/api/offers.api", () => ({ offersApi: api }));
vi.mock("sonner", () => ({ toast }));
// The Lottie player behind the loader needs IntersectionObserver.
vi.mock("@/components/ui/page-loader", () => ({
  PageLoader: () => <div data-testid="loader" />,
}));

import { PendingOffersPanel } from "../PendingOffersPanel";

// Rendered open through state, but Radix still reaches for these in jsdom
// (radix-dialogs-in-jsdom in project memory).
beforeEach(() => {
  window.HTMLElement.prototype.hasPointerCapture ??= () => false;
  window.HTMLElement.prototype.setPointerCapture ??= () => {};
  window.HTMLElement.prototype.releasePointerCapture ??= () => {};
  window.HTMLElement.prototype.scrollIntoView ??= () => {};
  api.mine.mockReset();
  api.withdraw.mockReset();
});

const slot = (id: string, day: string, period: "morning" | "afternoon" | "evening") => ({
  id,
  day,
  slot: period,
  startsAt: `${day}T06:00:00.000Z`,
  endsAt: `${day}T10:00:00.000Z`,
  deliveryAt: `${day}T20:00:00.000Z`,
});

const OFFER: PendingOffer = {
  proposedAt: null,
  counterPriceCents: null,
  counterNote: null,
  counteredAt: null,
  counterRounds: 0,
  id: "off_1",
  listingId: "job_1",
  priceCents: 18_000,
  estimatedPickup: "2026-10-22T06:00:00.000Z",
  estimatedDelivery: "2026-10-23T20:00:00.000Z",
  deliveryLeadDays: 1,
  slots: [
    slot("s1", "2026-10-22", "morning"),
    slot("s2", "2026-10-23", "afternoon"),
    slot("s3", "2026-10-24", "evening"),
  ],
  message: null,
  status: "pending",
  createdAt: "2026-10-15T09:00:00.000Z",
  carrier: { id: "user_c", name: "Jean Martin", image: null, rating: 4.8 },
  vehicle: { id: "veh_1", type: "van", make: null, model: null, maxWeightKg: 800 },
  listing: {
    id: "job_1",
    reference: 100042,
    title: "Armoire normande",
    pickupCity: "Caen",
    dropoffCity: "Rennes",
  },
};

function renderPanel(locale: "fr" | "en" = "fr") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onError = vi.fn<(error: Error) => void>();
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider
        locale={locale}
        messages={locale === "fr" ? fr : en}
        onError={onError}
      >
        <PendingOffersPanel />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
  return onError;
}

describe("PendingOffersPanel", () => {
  it("asks for the carrier's pending offers only", async () => {
    api.mine.mockResolvedValue([]);
    renderPanel();

    await screen.findByText("Aucune offre en attente");
    expect(api.mine).toHaveBeenCalledWith({ status: "pending", limit: 50 });
  });

  it("shows the job, the cities, the price and the earliest slot of each offer", async () => {
    api.mine.mockResolvedValue([OFFER]);
    const onError = renderPanel();

    expect(await screen.findByText("Armoire normande")).toBeInTheDocument();
    expect(screen.getByText("Réf. 100042")).toBeInTheDocument();
    expect(screen.getByText("Caen")).toBeInTheDocument();
    expect(screen.getByText("Rennes")).toBeInTheDocument();
    expect(screen.getByText(euros(18_000))).toBeInTheDocument();
    expect(
      screen.getByText(
        "Enlèvement au plus tôt : jeu. 22 oct. — matin · +2 autres créneaux proposés"
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voir la course" })).toHaveAttribute(
      "href",
      "/listing/job_1"
    );
    expect(screen.getByRole("button", { name: "Retirer l'offre" })).toBeEnabled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("names no other slots when only one was proposed", async () => {
    api.mine.mockResolvedValue([{ ...OFFER, slots: [OFFER.slots[0]] }]);
    renderPanel();

    expect(
      await screen.findByText("Enlèvement au plus tôt : jeu. 22 oct. — matin")
    ).toBeInTheDocument();
  });

  it("reads in English", async () => {
    api.mine.mockResolvedValue([OFFER]);
    const onError = renderPanel("en");

    expect(
      await screen.findByText("Earliest pickup: Thu 22 Oct — morning · +2 other slots proposed")
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View the job" })).toBeInTheDocument();
    expect(onError).not.toHaveBeenCalled();
  });

  it("has its own empty state, pointing at the board", async () => {
    api.mine.mockResolvedValue([]);
    renderPanel();

    expect(await screen.findByText("Aucune offre en attente")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voir les courses" })).toHaveAttribute(
      "href",
      "/expedion"
    );
  });

  it("says the list failed, and tries again on « Réessayer »", async () => {
    api.mine
      .mockRejectedValueOnce(new ApiError("INTERNAL_ERROR", "boom", 500))
      .mockResolvedValueOnce([OFFER]);
    renderPanel();

    expect(await screen.findByText("Impossible de charger cette liste")).toBeInTheDocument();
    expect(screen.queryByText("Aucune offre en attente")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));

    expect(await screen.findByText("Armoire normande")).toBeInTheDocument();
    expect(api.mine).toHaveBeenCalledTimes(2);
  });

  it("explains, rather than offering a retry, to an account without the carrier role", async () => {
    api.mine.mockRejectedValue(
      new ApiError("FORBIDDEN_NOT_CARRIER", "Carrier role required", 403)
    );
    renderPanel();

    expect(
      await screen.findByText("Les offres sont réservées aux transporteurs validés")
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Réessayer" })).not.toBeInTheDocument();
  });

  it("withdraws through the existing endpoint after confirming, then refreshes the tab", async () => {
    api.mine.mockResolvedValueOnce([OFFER]).mockResolvedValue([]);
    api.withdraw.mockResolvedValue({ ...OFFER, status: "withdrawn" });
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "Retirer l'offre" }));
    expect(api.withdraw).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByRole("button", { name: "Retirer" }));

    await waitFor(() => expect(api.withdraw).toHaveBeenCalledWith("off_1"));
    expect(await screen.findByText("Aucune offre en attente")).toBeInTheDocument();
    expect(api.mine).toHaveBeenCalledTimes(2);
    expect(toast.success).toHaveBeenCalledWith("Offre retirée");
  });

  it("does nothing when the confirmation is cancelled", async () => {
    api.mine.mockResolvedValue([OFFER]);
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "Retirer l'offre" }));
    fireEvent.click(await screen.findByRole("button", { name: "Annuler" }));

    await waitFor(() =>
      expect(screen.queryByText("Retirer cette offre ?")).not.toBeInTheDocument()
    );
    expect(api.withdraw).not.toHaveBeenCalled();
  });

  it("says so in French when the offer was answered meanwhile, and refreshes", async () => {
    api.mine.mockResolvedValueOnce([OFFER]).mockResolvedValue([]);
    api.withdraw.mockRejectedValue(
      new ApiError("OFFER_NOT_PENDING", "Offer is not pending", 409)
    );
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "Retirer l'offre" }));
    fireEvent.click(await screen.findByRole("button", { name: "Retirer" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Cette offre a déjà reçu une réponse ou a expiré."
      )
    );
    await waitFor(() => expect(api.mine).toHaveBeenCalledTimes(2));
  });
});
