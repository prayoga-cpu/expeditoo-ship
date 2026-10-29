import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import fr from "../../../../../../messages/fr.json";

/** client_feedback_2026_10_29_spec.md §B1, §B6 — the requester's and the operator's side. */

const m = vi.hoisted(() => ({ propose: vi.fn(), counter: vi.fn() }));
vi.mock("@/features/app/offers/hooks/useNegotiation", () => ({
  useProposeOffer: () => ({ mutate: m.propose, isPending: false }),
  useCounterOffer: () => ({ mutate: m.counter, isPending: false }),
}));

import { OfferNegotiation } from "../OfferNegotiation";
import type { Offer } from "../../types";

const t = fr.negotiation;
const offer = (over: Partial<Offer> = {}) =>
  ({
    id: "o1",
    priceCents: 20_000,
    status: "pending",
    proposedAt: null,
    counterPriceCents: null,
    counterNote: null,
    counteredAt: null,
    counterRounds: 0,
    ...over,
  }) as Offer;

const renderIt = (o: Offer, canPropose = false, canCounter = false) =>
  render(
    <NextIntlClientProvider locale="fr" messages={fr} timeZone="Europe/Paris">
      <OfferNegotiation offer={o} canPropose={canPropose} canCounter={canCounter} />
    </NextIntlClientProvider>
  );

beforeEach(() => vi.clearAllMocks());

describe("OfferNegotiation", () => {
  it("lets an operator recommend an offer, and take it back", () => {
    const { unmount } = renderIt(offer(), true);
    fireEvent.click(screen.getByRole("button", { name: t.propose }));
    expect(m.propose).toHaveBeenCalledWith({ offerId: "o1", propose: true });
    unmount();

    renderIt(offer({ proposedAt: "2026-10-29T10:00:00.000Z" }), true);
    fireEvent.click(screen.getByRole("button", { name: t.unpropose }));
    expect(m.propose).toHaveBeenCalledWith({ offerId: "o1", propose: false });
  });

  it("sends the requester's price, read from the box in cents", () => {
    renderIt(offer(), false, true);
    fireEvent.click(screen.getByRole("button", { name: t.counter }));
    const send = screen.getByRole("button", { name: t.sendCounter });
    expect(send).toBeDisabled();

    fireEvent.change(screen.getByLabelText(t.counterPrice), { target: { value: "165,50" } });
    fireEvent.change(screen.getByLabelText(t.counterNote), { target: { value: "Mon budget" } });
    fireEvent.click(send);
    expect(m.counter).toHaveBeenCalledWith(
      { offerId: "o1", priceCents: 16_550, note: "Mon budget" },
      expect.anything()
    );
  });

  it("refuses the price already on the table", () => {
    renderIt(offer(), false, true);
    fireEvent.click(screen.getByRole("button", { name: t.counter }));
    fireEvent.change(screen.getByLabelText(t.counterPrice), { target: { value: "200" } });
    expect(screen.getByRole("button", { name: t.sendCounter })).toBeDisabled();
  });

  it("waits for the carrier while a counter-price is out", () => {
    renderIt(offer({ counterPriceCents: 16_000 }), false, true);
    expect(screen.getByText(/attend la réponse du transporteur/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.counter })).not.toBeInTheDocument();
  });

  it("stops offering a counter after the last round", () => {
    renderIt(offer({ counterRounds: 5 }), false, true);
    expect(screen.queryByRole("button", { name: t.counter })).not.toBeInTheDocument();
  });

  it("renders nothing once the offer is no longer pending", () => {
    const { container } = renderIt(offer({ status: "accepted" }), true, true);
    expect(container.innerHTML).toBe("");
  });
});
