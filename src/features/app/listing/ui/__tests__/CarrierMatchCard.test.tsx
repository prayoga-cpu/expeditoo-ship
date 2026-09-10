import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import fr from "../../../../../../messages/fr.json";
import type { CarrierMatch } from "../../api/carriers.api";

import { CarrierMatchCard } from "../CarrierMatchCard";

/**
 * The §4.4 badge, which is the whole of what feedback item #16 was answered
 * with: the Particuliers / Professionnels checkboxes were declined because the
 * data cannot partition the set (§4.5), so the distinction is shown where it is
 * genuinely known and left absent where it is not.
 *
 * These assert the *absence* as hard as the presence. A card that prints
 * « Particulier » for a carrier who declared nothing would be inventing a fact
 * about their legal status, which is the failure the whole section is about.
 */

const match = (over: Partial<CarrierMatch> = {}): CarrierMatch => ({
  matchId: "route-1",
  displayName: "Faissal B.",
  avatarUrl: null,
  rating: 4.5,
  reviewCount: 3,
  legalForm: null,
  originCity: "Bordeaux",
  destinationCity: "Paris",
  nextRuns: ["2026-09-08"],
  detourKm: 12,
  ...over,
});

const renderCard = (over: Partial<CarrierMatch> = {}) =>
  render(
    <NextIntlClientProvider locale="fr" messages={fr} onError={vi.fn()}>
      <CarrierMatchCard
        match={match(over)}
        isContacting={false}
        disabled={false}
        onContact={vi.fn()}
      />
    </NextIntlClientProvider>
  );

describe("CarrierMatchCard — the legal form badge", () => {
  it("shows the legal form the carrier declared, as they wrote it", () => {
    renderCard({ legalForm: "SASU" });

    expect(screen.getByText("SASU")).toBeInTheDocument();
  });

  it("shows nothing at all when the carrier declared none", () => {
    const { container } = renderCard({ legalForm: null });

    // Not « Particulier », and not an empty chip either: an undeclared legal
    // form is an absence of information (§4.5).
    expect(screen.queryByText(/particulier/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/professionnel/i)).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="badge"]')).toHaveLength(
      // Only the one run day. The legal-form badge is not rendered.
      1
    );
  });

  it("keeps a long declaration inside the card", () => {
    const long = "société par actions simplifiée unipersonnelle";

    renderCard({ legalForm: long });

    const badge = screen.getByText(long);

    // The DTO bounds the value; the card bounds the layout. Without both, one
    // carrier's typing pushes the Contacter button off the row.
    expect(badge.className).toContain("truncate");
    expect(badge.className).toContain("max-w-36");
    // A clipped badge stays readable rather than merely short.
    expect(badge).toHaveAttribute("title", long);
  });

  it("still discloses no user id beside it", () => {
    // The badge widened the projection by one field, and by one only: contact
    // travels by `matchId`, which the server re-matches (§6.2).
    const { container } = renderCard({ legalForm: "EURL" });

    expect(container.innerHTML).not.toContain("user-");
  });
});
