import { render as rtlRender, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import fr from "../../../../../../messages/fr.json";
import type { Job } from "../../types";

/**
 * The job page's header: listing_reference_spec.md §3 (the reference, with a
 * copy button) and expedion_source_hidden_spec.md §2 (no origin badge).
 *
 * The data hooks are stood in for; with no viewer and no operator the page
 * renders without its tab strip, so nothing here needs a router.
 */

const hooks = vi.hoisted(() => ({ job: undefined as unknown }));

vi.mock("../../hooks/useJobDetail", () => ({
  useJobDetail: () => ({ data: hooks.job, isLoading: false }),
  useJobOffers: () => ({ data: { scope: "full", offers: [] } }),
  useAcceptOffer: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("../../hooks/useListingCarriers", () => ({
  useListingCarriers: () => ({ data: undefined }),
}));
vi.mock("../JobBidSection", () => ({ JobBidSection: () => null }));

import { JobDetail } from "../JobDetail";

const JOB: Job = {
  id: "job_1",
  reference: 100042,
  shipperId: "user_1",
  status: "open",
  reopenedAt: null,
  title: "Armoire normande",
  description: "Une armoire démontée, deux colis.",
  weightKg: 90,
  lengthCm: null,
  widthCm: null,
  heightCm: null,
  quantity: 2,
  isFragile: false,
  needsHelp: false,
  packagingLevel: null,
  needsProtection: false,
  needsPackaging: false,

  pickupAddress: "1 rue de la Gare",
  pickupCity: "Caen",
  pickupPostalCode: "14000",
  pickupLocationType: "house",
  pickupLat: 49.18,
  pickupLng: -0.37,

  dropoffAddress: "2 place du Marché",
  dropoffCity: "Rennes",
  dropoffPostalCode: "35000",
  dropoffLocationType: "house",
  dropoffLat: 48.11,
  dropoffLng: -1.68,

  pickupFrom: "2026-10-05T08:00:00.000Z",
  pickupUntil: "2026-10-05T16:00:00.000Z",
  dropoffFrom: "2026-10-06T08:00:00.000Z",
  dropoffUntil: "2026-10-06T16:00:00.000Z",
  isFlexible: false,

  budgetCents: 25_000,
  acceptedOfferId: null,
  origin: "direct",

  offersCount: 0,
  views: 0,
  expiresAt: "2026-10-05T02:00:00.000Z",
  createdAt: "2026-09-30T00:00:00.000Z",
};

const render = () =>
  rtlRender(
    <NextIntlClientProvider locale="fr" messages={fr}>
      <JobDetail listingId="job_1" viewerId={null} />
    </NextIntlClientProvider>
  );

beforeEach(() => {
  hooks.job = JOB;
});

describe("JobDetail header", () => {
  it("names the job by its reference, with a way to copy it", () => {
    render();

    expect(screen.getByText("Réf. 100042")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copier la référence" })
    ).toBeInTheDocument();
  });

  it("does not tell anyone an escalated job came from Expedion", () => {
    hooks.job = { ...JOB, origin: "expedion" };
    const { container } = render();

    expect(container.textContent).not.toMatch(/expedion/i);
    // The reference is the same kind of number on both inlets.
    expect(screen.getByText("Réf. 100042")).toBeInTheDocument();
  });
});
