import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../../../messages/en.json";
import fr from "../../../../../messages/fr.json";
import type { Job } from "@/features/app/listing/types";

/**
 * The page after « Publier la demande » (request_posted_page_spec.md §3).
 */

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
}));

let query: { data?: Job; isLoading: boolean; isError: boolean };
vi.mock("@/features/app/listing/hooks/useJobDetail", () => ({
  useJobDetail: () => query,
}));

import { RequestPostedScreen } from "../ui/RequestPostedScreen";

const job = (over: Partial<Job> = {}) =>
  ({
    id: "job-1",
    reference: 100042,
    shipperId: "user-1",
    status: "open",
    title: "Canapé",
    pickupCity: "Lyon",
    dropoffCity: "Paris",
    pickupFrom: "2026-10-03T04:00:00.000Z",
    pickupUntil: "2026-10-03T10:00:00.000Z",
    dropoffFrom: "2026-10-04T04:00:00.000Z",
    dropoffUntil: "2026-10-04T20:00:00.000Z",
    isFlexible: true,
    pickupDays: [1, 2, 3, 4, 5, 6, 7],
    pickupPeriods: ["morning"],
    packagingLevel: null,
    needsProtection: false,
    needsPackaging: false,
    isFragile: false,
    needsHelp: false,
    weightKg: 40,
    quantity: 1,
    budgetCents: 4_000,
    // 06:00 in Paris on the 3rd.
    expiresAt: "2026-10-03T04:00:00.000Z",
    scheduledPublishAt: null,
    ...over,
  }) as Job;

function renderScreen(locale: "fr" | "en" = "fr", viewerId = "user-1") {
  const onError = vi.fn<(error: Error) => void>();
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "en" ? en : fr}
      timeZone="Europe/Paris"
      onError={onError}
    >
      <RequestPostedScreen listingId="job-1" viewerId={viewerId} />
    </NextIntlClientProvider>
  );
  return { onError };
}

const link = (name: string) => screen.getByRole("link", { name });

beforeEach(() => {
  query = { data: job(), isLoading: false, isError: false };
});

describe("RequestPostedScreen", () => {
  it("thanks the requester for a live request and says what happens next", () => {
    const { onError } = renderScreen();

    expect(
      screen.getByRole("heading", { level: 1, name: fr.create.success.open.title })
    ).toBeInTheDocument();
    expect(screen.getByText("Réf. 100042")).toBeInTheDocument();
    expect(screen.getByText(/jusqu'au 3 oct\./)).toBeInTheDocument();
    expect(screen.getByText(fr.create.success.next.notify)).toBeInTheDocument();
    expect(screen.getByText(fr.create.success.next.choose)).toBeInTheDocument();
    expect(screen.getByText(fr.create.success.next.pay)).toBeInTheDocument();
    expect(screen.getByText(/40,00\s€/)).toBeInTheDocument();
    // The request read back, its times of day included.
    expect(screen.getByText("Matin")).toBeInTheDocument();
    expect(onError).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("moves focus to the heading, so a screen reader hears it", () => {
    renderScreen();

    expect(document.activeElement).toBe(
      screen.getByRole("heading", { level: 1, name: fr.create.success.open.title })
    );
  });

  it("keeps the headings in order: the request title under the h1", () => {
    renderScreen();

    expect(screen.getByRole("heading", { level: 2, name: "Canapé" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 3 })).toBeNull();
  });

  it("never claims an email was sent", () => {
    renderScreen();

    expect(document.body.textContent).not.toMatch(/e-mail|email/i);
  });

  it("links to the request, the list and a new request", () => {
    renderScreen();

    expect(link(fr.create.success.actions.view)).toHaveAttribute("href", "/listing/job-1");
    expect(link(fr.create.success.actions.myRequests)).toHaveAttribute(
      "href",
      "/listings/me"
    );
    expect(link(fr.create.success.actions.another)).toHaveAttribute("href", "/create");
  });

  it("says when a scheduled request goes live", () => {
    query.data = job({
      status: "scheduled",
      scheduledPublishAt: "2026-10-02T18:00:00.000Z",
    });
    renderScreen();

    expect(
      screen.getByRole("heading", { level: 1, name: fr.create.success.scheduled.title })
    ).toBeInTheDocument();
    expect(screen.getByText(/Elle sera publiée le 2 oct\./)).toBeInTheDocument();
  });

  it("reads in English", () => {
    const { onError } = renderScreen("en");

    expect(
      screen.getByRole("heading", { level: 1, name: en.create.success.open.title })
    ).toBeInTheDocument();
    expect(onError).not.toHaveBeenCalled();
  });

  it("offers the list when the request cannot be found", () => {
    query = { data: undefined, isLoading: false, isError: true };
    renderScreen();

    expect(screen.getByText(fr.create.success.notFound.title)).toBeInTheDocument();
    expect(link(fr.create.success.actions.myRequests)).toHaveAttribute(
      "href",
      "/listings/me"
    );
  });

  it("hands someone else's request to its own page", () => {
    renderScreen("fr", "someone-else");

    expect(replace).toHaveBeenCalledWith("/listing/job-1");
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("hands a request that has moved on to its own page", () => {
    query.data = job({ status: "awarded" });
    renderScreen();

    expect(replace).toHaveBeenCalledWith("/listing/job-1");
  });

  it("shows nothing but the loader while the request loads", () => {
    query = { data: undefined, isLoading: true, isError: false };
    renderScreen();

    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });
});
