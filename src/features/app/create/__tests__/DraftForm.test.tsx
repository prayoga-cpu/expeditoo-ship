import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { NextIntlClientProvider, createTranslator, type Messages } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/fetcher";
import fr from "../../../../../messages/fr.json";

/**
 * Loading a request to finish it (draft_requests_spec.md §2): read once, kept
 * on screen once read, and « introuvable » only when the server says so. The
 * form itself is stood in for — `useJobForm.test.tsx` covers it.
 */

/** Catalogue text by its path, resolved as the page resolves it. */
const tr = createTranslator({
  locale: "fr",
  messages: fr as Messages,
  onError: () => {},
});

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));
vi.mock("@/components/ui/lottie-loader", () => ({ LottieLoader: () => null }));

const getDraft = vi.fn();
vi.mock("@/features/app/listing/api/listings.api", () => ({
  listingsApi: { getDraft: (...a: unknown[]) => getDraft(...a) },
}));
vi.mock("../hooks/useJobForm", () => ({ useJobForm: () => ({}) }));
vi.mock("../ui/JobForm", () => ({ JobForm: () => <div data-testid="job-form" /> }));

import { DraftForm } from "../ui/RequestForms";

function renderForm(client = new QueryClient()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="fr" messages={fr} timeZone="Europe/Paris">
        {children}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
  return render(<DraftForm draftId="draft-7" startStep={0} publishNow={false} />, { wrapper });
}

const DRAFT = { id: "draft-7", status: "draft" };

beforeEach(() => {
  getDraft.mockResolvedValue(DRAFT);
});

afterEach(() => {
  onlineManager.setOnline(true);
});

describe("DraftForm, once the request is read", () => {
  it("keeps the form through a reconnect whose read would fail", async () => {
    renderForm();
    await screen.findByTestId("job-form");

    // The connection drops and comes back; a second read would fail.
    getDraft.mockRejectedValue(new ApiError("INVALID_RESPONSE", "Unexpected server response", 502));
    act(() => onlineManager.setOnline(false));
    act(() => onlineManager.setOnline(true));
    await act(async () => {});

    expect(screen.getByTestId("job-form")).toBeInTheDocument();
    expect(getDraft).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(fr.create.resume.notFound)).toBeNull();
  });

  it("waits, rather than calls it missing, when opened offline", async () => {
    act(() => onlineManager.setOnline(false));
    renderForm();
    await act(async () => {});

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText(fr.create.resume.notFound)).toBeNull();

    act(() => onlineManager.setOnline(true));
    expect(await screen.findByTestId("job-form")).toBeInTheDocument();
  });
});

describe("DraftForm, when the request cannot be read", () => {
  it("says « introuvable » for a 404, and refreshes the copies that still show it", async () => {
    // Deleted in another tab: the list « Mes demandes » links back to, and
    // the request's own page, must not go on showing it from the cache.
    getDraft.mockRejectedValue(new ApiError("LISTING_NOT_FOUND", "Listing not found", 404));
    const client = new QueryClient();
    client.setQueryData(["my-jobs", "all"], [DRAFT]);
    client.setQueryData(["job", "draft-7"], DRAFT);
    renderForm(client);

    expect(await screen.findByText(fr.create.resume.notFound)).toBeInTheDocument();
    await waitFor(() => expect(client.getQueryState(["my-jobs", "all"])?.isInvalidated).toBe(true));
    expect(client.getQueryState(["job", "draft-7"])?.isInvalidated).toBe(true);
    expect(replace).not.toHaveBeenCalled();
  });

  it("says the load failed for anything else, and reads again on « Réessayer »", async () => {
    getDraft.mockRejectedValueOnce(new ApiError("INTERNAL_ERROR", "Internal error", 500));
    renderForm();

    expect(await screen.findByText(tr("myJobs.detail.loadError.title"))).toBeInTheDocument();
    expect(screen.queryByText(fr.create.resume.notFound)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: tr("myJobs.detail.loadError.retry") }));

    expect(await screen.findByTestId("job-form")).toBeInTheDocument();
    expect(getDraft).toHaveBeenCalledTimes(2);
  });

  it("hands a request gone live over to its page, with that page's copy refreshed", async () => {
    getDraft.mockRejectedValue(new ApiError("LISTING_NOT_DRAFT", "Listing is not a draft", 409));
    const client = new QueryClient();
    client.setQueryData(["job", "draft-7"], { id: "draft-7", status: "scheduled" });
    renderForm(client);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/listing/draft-7"));
    expect(client.getQueryState(["job", "draft-7"])?.isInvalidated).toBe(true);
  });
});
