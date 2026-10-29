import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import fr from "../../../../../../messages/fr.json";

/** client_feedback_2026_10_29_spec.md §B6 — the carrier's answer. */

const m = vi.hoisted(() => ({ respond: vi.fn() }));
vi.mock("@/features/app/offers/hooks/useNegotiation", () => ({
  useRespondToCounter: () => ({ mutate: m.respond, isPending: false }),
}));

import { CounterResponse } from "../CounterResponse";
import type { Offer } from "@/features/app/listing/types";

const t = fr.negotiation;
const offer = (over: Partial<Offer> = {}) =>
  ({
    id: "o1",
    priceCents: 20_000,
    status: "pending",
    proposedAt: null,
    counterPriceCents: 16_000,
    counterNote: "Mon budget",
    counteredAt: "2026-10-29T10:00:00.000Z",
    counterRounds: 1,
    ...over,
  }) as Offer;

const renderIt = (o: Offer) =>
  render(
    <NextIntlClientProvider locale="fr" messages={fr} timeZone="Europe/Paris">
      <CounterResponse offer={o} />
    </NextIntlClientProvider>
  );

beforeEach(() => vi.clearAllMocks());

describe("CounterResponse", () => {
  it("shows the client's price beside the carrier's own, and the note", () => {
    renderIt(offer());
    expect(screen.getByText(/Le client propose/)).toBeInTheDocument();
    expect(screen.getByText("« Mon budget »")).toBeInTheDocument();
  });

  it.each([
    [t.acceptClientPrice, { action: "accept" }],
    [t.keepMine, { action: "decline" }],
  ])("answers « %s »", (label, answer) => {
    renderIt(offer());
    fireEvent.click(screen.getByRole("button", { name: label }));
    expect(m.respond).toHaveBeenCalledWith({ offerId: "o1", answer });
  });

  it("answers with another price", () => {
    renderIt(offer());
    fireEvent.click(screen.getByRole("button", { name: t.otherPrice }));
    fireEvent.change(screen.getByLabelText(t.yourNewPrice), { target: { value: "180" } });
    fireEvent.click(screen.getByRole("button", { name: t.sendNewPrice }));
    expect(m.respond).toHaveBeenCalledWith({
      offerId: "o1",
      answer: { action: "revise", priceCents: 18_000 },
    });
  });

  it("says when Expeditoo recommended the offer, with no counter-price out", () => {
    renderIt(offer({ counterPriceCents: null, proposedAt: "2026-10-29T10:00:00.000Z" }));
    expect(screen.getByText(t.proposedToClient)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.acceptClientPrice })).not.toBeInTheDocument();
  });

  it("renders nothing with nothing to say", () => {
    const { container } = renderIt(offer({ counterPriceCents: null }));
    expect(container.innerHTML).toBe("");
  });
});
