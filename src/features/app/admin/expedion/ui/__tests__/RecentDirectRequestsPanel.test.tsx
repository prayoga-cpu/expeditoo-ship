import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import en from "../../../../../../../messages/en.json";
import fr from "../../../../../../../messages/fr.json";
import type { AdminListing } from "@/features/app/admin/hooks/useAdminListings";

import { RecentDirectRequestsPanel } from "../RecentDirectRequestsPanel";

/**
 * Supervision's "Demandes directes" card (request_summary_spec.md §3.2): a
 * request posted at `/create` reaches the admin landing page, and every state
 * of the query says something rather than rendering blank.
 */

// Asserted rather than annotated, as the listing tests do with `Job`: the
// panel reads only these fields, and the row type grows as others are added.
const row = (over: Partial<AdminListing> = {}) =>
  ({
    id: "job-1",
    title: "Canapé",
    shipper: { name: "Denis Nicolas", email: "denis@example.com" },
    budgetCents: 12_000,
    status: "open",
    origin: "direct",
    pickupCity: "Bruxelles",
    dropoffCity: "Paris",
    createdAt: "2026-09-26T08:30:00.000Z",
    views: 0,
    ...over,
  }) as AdminListing;

type Props = Parameters<typeof RecentDirectRequestsPanel>[0];

function renderPanel(props: Partial<Props> = {}, locale: "en" | "fr" = "fr") {
  const onError = vi.fn<(error: Error) => void>();
  const view = render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "en" ? en : fr}
      timeZone="Europe/Paris"
      onError={onError}
    >
      <RecentDirectRequestsPanel
        rows={[]}
        total={0}
        isLoading={false}
        isError={false}
        {...props}
      />
    </NextIntlClientProvider>
  );
  return { onError, ...view };
}

describe("RecentDirectRequestsPanel", () => {
  it("lists each request with its route, requester and a deep link", () => {
    const { onError } = renderPanel({
      rows: [row(), row({ id: "job 2", title: "Piano", status: "awarded" })],
      total: 7,
    });

    expect(screen.getByText("7 au total")).toBeInTheDocument();

    const sofa = screen.getByRole("link", { name: /Canapé/ });
    expect(sofa).toHaveAttribute("href", "/admin/listings?id=job-1");
    expect(within(sofa).getByText("Bruxelles → Paris")).toBeInTheDocument();
    expect(within(sofa).getByText("par Denis Nicolas")).toBeInTheDocument();
    expect(within(sofa).getByText("Ouverte")).toBeInTheDocument();

    // An id is escaped rather than trusted to be URL-safe.
    expect(screen.getByRole("link", { name: /Piano/ })).toHaveAttribute(
      "href",
      "/admin/listings?id=job%202"
    );
    expect(onError.mock.calls.map(([e]) => e.message)).toEqual([]);
  });

  it("links to the full list of listings", () => {
    renderPanel({ rows: [row()], total: 1 });
    expect(
      screen.getByRole("link", { name: "Toutes les annonces" })
    ).toHaveAttribute("href", "/admin/listings");
  });

  it("says so when nothing has been posted yet", () => {
    renderPanel();
    expect(
      screen.getByText("Aucune demande directe pour l'instant")
    ).toBeInTheDocument();
    expect(screen.getByText("0 au total")).toBeInTheDocument();
  });

  it("says the load failed instead of rendering blank, and hides the count", () => {
    renderPanel({ isError: true });
    expect(
      screen.getByText("Impossible de charger les demandes directes")
    ).toBeInTheDocument();
    expect(screen.queryByText(/au total/)).not.toBeInTheDocument();
  });

  it("shows a loading line while the query runs", () => {
    renderPanel({ isLoading: true });
    expect(screen.getByText("Chargement…")).toBeInTheDocument();
  });

  it("resolves every label in English", () => {
    const { onError } = renderPanel({ rows: [row()], total: 1 }, "en");

    expect(screen.getByText("Direct requests")).toBeInTheDocument();
    expect(screen.getByText("1 in total")).toBeInTheDocument();
    expect(screen.getByText("by Denis Nicolas")).toBeInTheDocument();
    expect(onError.mock.calls.map(([e]) => e.message)).toEqual([]);
  });
});
