import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import fr from "../../../../../../messages/fr.json";
import type { Offer, OfferSlot } from "../../types";
import { OfferCard } from "../OfferCard";

/**
 * client_feedback_2026_10_spec.md §4 (review): a flexible request takes offers
 * until its window ends, so an offer can outlive its earliest slots. The card
 * pre-selects the first slot still ahead and never lets a passed one be booked.
 */

const HOUR = 60 * 60 * 1000;
const iso = (ms: number) => new Date(Date.now() + ms).toISOString();
const day = (ms: number) => iso(ms).slice(0, 10);

const slot = (id: string, offsetMs: number): OfferSlot => ({
  id,
  day: day(offsetMs),
  slot: "morning",
  startsAt: iso(offsetMs),
  endsAt: iso(offsetMs + 4 * HOUR),
  deliveryAt: iso(offsetMs + 20 * HOUR),
});

const offer = (slots: OfferSlot[]): Offer =>
  ({
    id: "offer-1",
    listingId: "job-1",
    priceCents: 9_000,
    estimatedPickup: slots[0].startsAt,
    estimatedDelivery: slots[0].deliveryAt,
    deliveryLeadDays: 1,
    slots,
    message: null,
    status: "pending",
    createdAt: iso(-48 * HOUR),
    carrier: { id: "c1", name: "Transports Test", image: null, rating: 4.5, completedJobs: 3, companyName: null },
    vehicle: { id: "v1", type: "van", make: null, model: null, maxWeightKg: 800 },
    proposedAt: null,
    counterPriceCents: null,
    counterNote: null,
    counteredAt: null,
    counterRounds: 0,
  }) as Offer;

function renderCard(o: Offer, onAccept = vi.fn()) {
  render(
    <NextIntlClientProvider locale="fr" messages={fr} timeZone="Europe/Paris">
      <OfferCard offer={o} budgetCents={10_000} canAccept isAccepting={false} isLowest onAccept={onAccept} />
    </NextIntlClientProvider>
  );
  return onAccept;
}

describe("OfferCard — slots that have passed", () => {
  it("pre-selects the first slot still ahead and disables the passed one", () => {
    const onAccept = renderCard(offer([slot("past", -30 * HOUR), slot("ahead", 30 * HOUR)]));

    const radios = screen.getAllByRole("radio");
    expect(radios[0]).toBeDisabled();
    expect(radios[1]).toBeEnabled();
    expect(radios[1]).toHaveAttribute("data-state", "checked");

    fireEvent.click(screen.getByRole("button", { name: fr.listing.bid.offerCard.acceptSlot }));
    expect(onAccept).toHaveBeenCalledWith("offer-1", "ahead");
  });

  it("cannot be accepted once every slot has passed, and says why", () => {
    renderCard(offer([slot("past", -30 * HOUR)]));

    expect(screen.getByRole("button", { name: fr.listing.bid.offerCard.accept })).toBeDisabled();
    expect(screen.getByText(fr.listing.bid.offerCard.slotsPassed)).toBeInTheDocument();
  });
});

/** client_feedback_2026_10_29_spec.md §B1 — Expeditoo's pick. */
describe("OfferCard — Expeditoo's pick", () => {
  it("marks the recommended offer and asks the requester to pay to confirm", () => {
    const onAccept = renderCard({
      ...offer([slot("ahead", 30 * HOUR)]),
      proposedAt: iso(-HOUR),
    });

    expect(screen.getByText(fr.negotiation.proposedBadge)).toBeInTheDocument();
    expect(screen.getByText(fr.negotiation.proposedForYou)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: fr.negotiation.payToConfirm }));
    expect(onAccept).toHaveBeenCalledWith("offer-1", "ahead");
  });
});
