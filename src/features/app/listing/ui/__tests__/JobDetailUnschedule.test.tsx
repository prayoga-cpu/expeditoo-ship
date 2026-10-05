import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider, createTranslator, type Messages } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/fetcher";
import fr from "../../../../../../messages/fr.json";
import type { DraftJob, Job } from "../../types";

/**
 * « Repasser en brouillon » pressed on the request's own page
 * (draft_requests_spec.md §1, §4): that page is the one that must change. The
 * real page, its hooks and its actions, over the app's cache defaults; the
 * network, the router and the toasts are stood in for.
 */

/** Catalogue text by its path, resolved as the page resolves it. */
const tr = createTranslator({
  locale: "fr",
  messages: fr as Messages,
  onError: () => {},
});

const api = vi.hoisted(() => ({
  getById: vi.fn(),
  getOffers: vi.fn(),
  unschedule: vi.fn(),
  deleteDraft: vi.fn(),
}));
vi.mock("../../api/listings.api", () => ({ listingsApi: api }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/ui/lottie-loader", () => ({ LottieLoader: () => null }));
vi.mock("../../hooks/useListingCarriers", () => ({
  useListingCarriers: () => ({ data: undefined }),
}));
vi.mock("../JobBidSection", () => ({ JobBidSection: () => null }));

import { JobDetail } from "../JobDetail";

const SCHEDULED = {
  id: "job_1",
  reference: 100042,
  shipperId: "user_1",
  status: "scheduled",
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
  pickupFrom: "2030-01-07T08:00:00.000Z",
  pickupUntil: "2030-01-07T09:00:00.000Z",
  dropoffFrom: "2030-01-08T08:00:00.000Z",
  dropoffUntil: "2030-01-08T09:00:00.000Z",
  isFlexible: false,
  budgetCents: 25_000,
  acceptedOfferId: null,
  origin: "direct",
  offersCount: 0,
  views: 0,
  expiresAt: "2030-01-07T02:00:00.000Z",
  reopenedAt: null,
  scheduledPublishAt: "2030-01-05T17:00:00.000Z",
  publishedAt: null,
  createdAt: "2029-12-01T10:00:00.000Z",
  photos: [{ id: "p1", url: "https://x/1.jpg", order: 0 }],
} as Job;

/** What the server holds once it is a draft again. */
const DRAFT = { ...SCHEDULED, status: "draft", scheduledPublishAt: null } as Job;

/** The page's read of the request, which the server can change under it. */
let row: Job;

function renderPage() {
  // As in Providers.tsx: a copy read under a minute ago is served as fresh.
  const client = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000, retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="fr" messages={fr} timeZone="Europe/Paris">
        <JobDetail listingId="job_1" viewerId="user_1" />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  row = SCHEDULED;
  api.getById.mockImplementation(async () => row);
});

describe("JobDetail, un-scheduling the request it shows", () => {
  it("shows the draft it now is, banner and actions", async () => {
    api.unschedule.mockImplementation(async () => {
      row = DRAFT;
      // The endpoint's view: the row, without its photos.
      const { photos: _photos, ...view } = DRAFT;
      return view as DraftJob;
    });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: fr.myJobs.draft.unschedule }));

    expect(await screen.findByText(fr.myJobs.draft.bannerDraft)).toBeInTheDocument();
    expect(screen.queryByText(/Planifiée — publication le/)).toBeNull();
    expect(screen.queryByRole("button", { name: fr.myJobs.draft.unschedule })).toBeNull();
    expect(screen.getByRole("link", { name: fr.myJobs.draft.resume })).toBeInTheDocument();
  });

  it("says a request no longer scheduled is no longer scheduled, and shows what it is now", async () => {
    // Un-scheduled in another tab between this page's read and the press.
    api.unschedule.mockImplementation(async () => {
      row = DRAFT;
      throw new ApiError("LISTING_NOT_SCHEDULED", "Listing is not scheduled", 409);
    });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: fr.myJobs.draft.unschedule }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(tr("myJobs.draft.notScheduled")));
    expect(await screen.findByText(fr.myJobs.draft.bannerDraft)).toBeInTheDocument();
  });
});
