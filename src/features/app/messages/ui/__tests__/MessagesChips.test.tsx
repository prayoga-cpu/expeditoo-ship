import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider, createTranslator, type Messages as Catalogue } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import fr from "../../../../../../messages/fr.json";
import type { ListingChip } from "../../types";
import { Messages } from "../Messages";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const tr = createTranslator({ locale: "fr", messages: fr as Catalogue, onError: () => {} });

/** client_feedback_2026_10_21_spec.md §D5 */
const CHIPS: ListingChip[] = [
  { id: "j1", route: "Paris → Clamart", title: "Sofa", own: true },
  { id: "j2", route: "Caen → Rennes", title: "Armoire", own: false },
];

const renderInbox = (props: Partial<React.ComponentProps<typeof Messages>> = {}) =>
  render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      <Messages
        messages={[]}
        searchQuery=""
        onSearchChange={() => {}}
        listingChips={CHIPS}
        listingFilter={null}
        onListingFilterChange={() => {}}
        {...props}
      />
    </NextIntlClientProvider>
  );

describe("Messages search, by listing", () => {
  it("offers the live listings as departure → arrival chips", () => {
    renderInbox();

    expect(screen.getByText(tr("messages.chips.label"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Paris → Clamart/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Caen → Rennes/ })).toBeInTheDocument();
  });

  it("filters on a tap, and clears on a second tap", () => {
    const onChange = vi.fn();
    const { rerender } = renderInbox({ onListingFilterChange: onChange });

    fireEvent.click(screen.getByRole("button", { name: /Paris → Clamart/ }));
    expect(onChange).toHaveBeenLastCalledWith("j1");

    rerender(
      <NextIntlClientProvider locale="fr" messages={fr}>
        <Messages
          messages={[]}
          searchQuery=""
          onSearchChange={() => {}}
          listingChips={CHIPS}
          listingFilter="j1"
          onListingFilterChange={onChange}
        />
      </NextIntlClientProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: /Paris → Clamart/ }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("on the viewer's own request with no thread, points at the carriers on that route", () => {
    renderInbox({ listingFilter: "j1" });

    expect(
      screen.getByText(tr("messages.chips.emptyTitle", { route: "Paris → Clamart" }))
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: tr("messages.chips.findCarriers") })
    ).toHaveAttribute("href", "/listing/j1?tab=carriers");
  });

  it("on someone else's listing, opens the listing instead", () => {
    renderInbox({ listingFilter: "j2" });

    expect(
      screen.getByRole("link", { name: tr("messages.chips.openListing") })
    ).toHaveAttribute("href", "/listing/j2");
  });
});
