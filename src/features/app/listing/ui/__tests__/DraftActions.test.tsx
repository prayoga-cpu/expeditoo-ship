import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider, createTranslator, type Messages } from "next-intl";
import { toast } from "sonner";
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
 * A request nobody else has seen yet, finished from « Mes demandes » or its
 * own page (docs/specs/draft_requests_spec.md §1, §4).
 */

// jsdom lacks what Radix's dialog reaches for.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};

const api = vi.hoisted(() => ({
  deleteDraft: vi.fn(),
  unschedule: vi.fn(),
}));
vi.mock("../../api/listings.api", () => ({ listingsApi: api }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

let rows: Job[] = [];
vi.mock("../../hooks/useMyRequests", () => ({
  useMyRequests: () => ({ data: rows, isLoading: false, isError: false }),
}));

import { DraftActions } from "../DraftActions";
import { MyRequestsPanel } from "../MyRequestsPanel";

function wrap(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="fr" messages={fr} timeZone="Europe/Paris">
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

const D = fr.myJobs.draft;

beforeEach(() => {
  api.deleteDraft.mockResolvedValue({ deleted: true });
  api.unschedule.mockResolvedValue({});
});

describe("DraftActions", () => {
  it("offers a draft its three ways on", () => {
    wrap(<DraftActions job={{ id: "job-1", status: "draft" }} />);

    expect(screen.getByRole("link", { name: D.publish })).toHaveAttribute(
      "href",
      "/create?draft=job-1&step=budget"
    );
    expect(screen.getByRole("link", { name: D.resume })).toHaveAttribute("href", "/create?draft=job-1");
    expect(screen.getByRole("button", { name: D.delete })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: D.unschedule })).toBeNull();
  });

  it("offers a scheduled request publishing now and a way back to draft", () => {
    wrap(<DraftActions job={{ id: "job-1", status: "scheduled" }} />);

    expect(screen.getByRole("link", { name: D.publishNow })).toHaveAttribute(
      "href",
      "/create?draft=job-1&step=budget&publish=now"
    );
    expect(screen.getByRole("link", { name: D.edit })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: D.unschedule }));
    return waitFor(() => expect(api.unschedule).toHaveBeenCalled());
  });

  it("asks before deleting, then deletes", async () => {
    const onDeleted = vi.fn();
    wrap(
      <DraftActions job={{ id: "job-1", status: "draft" }} onDeleted={onDeleted} confirmOpen />
    );

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(D.deleteTitle)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: D.confirmDelete }));

    await waitFor(() => expect(api.deleteDraft).toHaveBeenCalled());
    expect(api.deleteDraft.mock.calls[0][0]).toBe("job-1");
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
  });

  it("keeps the request when the requester changes their mind", async () => {
    wrap(<DraftActions job={{ id: "job-1", status: "draft" }} confirmOpen onConfirmOpenChange={() => {}} />);

    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: D.keep }));

    expect(api.deleteDraft).not.toHaveBeenCalled();
  });

  it("asks about a scheduled request under its own title, with the shared description", async () => {
    wrap(<DraftActions job={{ id: "job-1", status: "scheduled" }} confirmOpen />);

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(D.deleteScheduledTitle)).toBeInTheDocument();
    expect(within(dialog).getByText(D.deleteDescription)).toBeInTheDocument();
  });
});

// What a refused delete or un-schedule says (draft_requests_spec.md §4): each
// true whatever happened in between, and none of them « réessayez ».
describe("DraftActions, refused", () => {
  async function confirmDelete() {
    wrap(<DraftActions job={{ id: "job-1", status: "draft" }} confirmOpen />);
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: D.confirmDelete })
    );
  }

  it("says a request deleted meanwhile cannot be found", async () => {
    api.deleteDraft.mockRejectedValue(new ApiError("LISTING_NOT_FOUND", "Listing not found", 404));
    await confirmDelete();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(tr("myJobs.draft.notFound")));
    expect(toast.error).not.toHaveBeenCalledWith(D.failed);
  });

  it("says a request published or closed meanwhile can no longer change here", async () => {
    api.deleteDraft.mockRejectedValue(new ApiError("LISTING_NOT_DRAFT", "Listing is not a draft", 409));
    await confirmDelete();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(tr("myJobs.draft.noLongerEditable"))
    );
  });

  it("says a request no longer scheduled is no longer scheduled", async () => {
    api.unschedule.mockRejectedValue(
      new ApiError("LISTING_NOT_SCHEDULED", "Listing is not scheduled", 409)
    );
    wrap(<DraftActions job={{ id: "job-1", status: "scheduled" }} />);

    fireEvent.click(screen.getByRole("button", { name: D.unschedule }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(tr("myJobs.draft.notScheduled")));
  });

  it("still offers a retry for a failure that is worth one", async () => {
    api.deleteDraft.mockRejectedValue(new TypeError("Failed to fetch"));
    await confirmDelete();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(D.failed));
  });
});

const job = (over: Partial<Job>): Job =>
  ({
    id: "job-1",
    reference: 100042,
    shipperId: "requester-1",
    status: "open",
    title: "Armoire normande",
    pickupCity: "Caen",
    dropoffCity: "Rennes",
    pickupFrom: "2030-01-07T08:00:00.000Z",
    pickupUntil: "2030-01-07T16:00:00.000Z",
    dropoffFrom: "2030-01-08T08:00:00.000Z",
    dropoffUntil: "2030-01-08T16:00:00.000Z",
    isFlexible: false,
    packagingLevel: null,
    needsProtection: false,
    needsPackaging: false,
    isFragile: false,
    needsHelp: false,
    weightKg: 90,
    quantity: 1,
    budgetCents: 25_000,
    offersCount: 0,
    createdAt: "2029-12-01T10:00:00.000Z",
    updatedAt: "2029-12-03T10:00:00.000Z",
    publishedAt: null,
    ...over,
  }) as Job;

describe("« Mes demandes » cards", () => {
  it("puts a draft's actions outside its link, and dates it by its last save", () => {
    rows = [job({ id: "d1", status: "draft" })];
    wrap(<MyRequestsPanel />);

    const card = screen.getByRole("link", { name: /Armoire normande/ });
    const publish = screen.getByRole("link", { name: D.publish });
    expect(card.contains(publish)).toBe(false);
    expect(screen.getByText(/^Enregistré le 3 déc\. 2029/)).toBeInTheDocument();
  });

  it("dates a scheduled request by when it goes live", () => {
    rows = [job({ id: "s1", status: "scheduled", scheduledPublishAt: "2030-01-05T17:00:00.000Z" })];
    wrap(<MyRequestsPanel />);

    expect(screen.getByText(/^Publication prévue le 5 janv\. 2030/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: D.unschedule })).toBeInTheDocument();
  });

  it("dates a live request by the day it really went live", () => {
    rows = [job({ id: "o1", status: "open", publishedAt: "2029-12-20T09:00:00.000Z" })];
    wrap(<MyRequestsPanel />);

    expect(screen.getByText(/^Publiée le 20 déc\. 2029/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: D.publish })).toBeNull();
  });

  // Expired by the scheduler before it could open, or cancelled while scheduled.
  it.each(["expired", "cancelled"] as const)(
    "never says « Publiée le » about a %s request that never went live",
    (status) => {
      rows = [job({ id: "x1", status, publishedAt: null, createdAt: "2029-12-01T10:00:00.000Z" })];
      wrap(<MyRequestsPanel />);

      expect(screen.getByText(tr("myJobs.created", { date: "1 déc. 2029" }))).toBeInTheDocument();
      expect(screen.queryByText(/^Publiée le/)).toBeNull();
    }
  );

  it("flags a draft whose dates have passed", () => {
    rows = [
      job({
        id: "d2",
        status: "draft",
        pickupFrom: "2020-01-07T08:00:00.000Z",
        pickupUntil: "2020-01-07T16:00:00.000Z",
      }),
    ];
    wrap(<MyRequestsPanel />);

    expect(screen.getByText(D.datesPassed)).toBeInTheDocument();
  });
});
