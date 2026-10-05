import { fireEvent, render as rtlRender, screen } from "@testing-library/react";
import { NextIntlClientProvider, createTranslator, type Messages } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/fetcher";
import fr from "../../../../../../messages/fr.json";
import type { Job } from "../../types";

/** Catalogue text by its path, resolved as the page resolves it. */
const tr = createTranslator({
  locale: "fr",
  messages: fr as Messages,
  onError: () => {},
});

/**
 * The job page's header: listing_reference_spec.md §3 (the reference, with a
 * copy button) and expedion_source_hidden_spec.md §2 (no origin badge).
 *
 * The data hooks are stood in for; with no viewer and no operator the page
 * renders without its tab strip, so nothing here needs a router.
 */

const hooks = vi.hoisted(() => ({
  job: undefined as unknown,
  error: null as unknown,
  refetch: (() => {}) as () => void,
}));

vi.mock("../../hooks/useJobDetail", () => ({
  useJobDetail: () => ({
    data: hooks.job,
    error: hooks.error,
    isFetching: false,
    refetch: hooks.refetch,
  }),
  useJobOffers: () => ({ data: { scope: "full", offers: [] } }),
  useAcceptOffer: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("../../hooks/useListingCarriers", () => ({
  useListingCarriers: () => ({ data: undefined }),
}));
vi.mock("../JobBidSection", () => ({ JobBidSection: () => null }));
vi.mock("../DraftActions", () => ({ DraftActions: () => <div data-testid="draft-actions" /> }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

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
  hooks.error = null;
  hooks.refetch = vi.fn();
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

// listing_privacy_spec.md §4
describe("JobDetail, as a viewer who may not read everything", () => {
  it("says the exact address goes to verified carriers when the street is withheld", () => {
    const { pickupAddress: _p, dropoffAddress: _d, ...cityOnly } = JOB;
    hooks.job = cityOnly;
    render();

    expect(screen.getAllByText(fr.myJobs.detail.addressHidden)).toHaveLength(2);
    expect(screen.getByText("14000 Caen")).toBeInTheDocument();
  });

  it("says a request cannot be found instead of loading forever", () => {
    hooks.job = undefined;
    hooks.error = new ApiError("LISTING_NOT_FOUND", "Listing not found", 404);
    render();

    expect(screen.getByText(fr.myJobs.detail.notFound)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: fr.myJobs.detail.backHome })).toHaveAttribute(
      "href",
      "/home"
    );
  });

  it("says the same for a request the viewer may not open", () => {
    hooks.job = undefined;
    hooks.error = new ApiError("FORBIDDEN", "Forbidden", 403);
    render();

    expect(screen.getByText(fr.myJobs.detail.notFound)).toBeInTheDocument();
  });

  it("calls a failed load a failed load, with a retry — never « retirée »", () => {
    hooks.job = undefined;
    hooks.error = new ApiError("INTERNAL_ERROR", "Internal error", 500);
    render();

    expect(screen.getByText(tr("myJobs.detail.loadError.title"))).toBeInTheDocument();
    expect(screen.queryByText(fr.myJobs.detail.notFound)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: tr("myJobs.detail.loadError.retry") }));
    expect(hooks.refetch).toHaveBeenCalledTimes(1);
  });

  it("keeps the page on screen when a later read fails for another reason", () => {
    hooks.error = new TypeError("Failed to fetch");
    render();

    expect(screen.getByText("Armoire normande")).toBeInTheDocument();
  });
});

// draft_requests_spec.md §1
describe("JobDetail, for the author of a request not yet live", () => {
  it("shows a draft's banner and its actions, and no offers section", () => {
    hooks.job = { ...JOB, status: "draft" };
    render();

    expect(screen.getByText(fr.myJobs.draft.bannerDraft)).toBeInTheDocument();
    expect(screen.getByTestId("draft-actions")).toBeInTheDocument();
    expect(screen.queryByText(fr.myJobs.detail.noOffers)).toBeNull();
  });

  it("says when a scheduled request goes live", () => {
    hooks.job = { ...JOB, status: "scheduled", scheduledPublishAt: "2026-10-05T06:00:00.000Z" };
    render();

    expect(screen.getByText(/Planifiée — publication le/)).toBeInTheDocument();
    expect(screen.getByText(fr.myJobs.status.scheduled)).toBeInTheDocument();
  });
});

