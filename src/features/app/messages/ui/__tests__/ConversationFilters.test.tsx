import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider, createTranslator, type Messages as Catalogue } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import fr from "../../../../../../messages/fr.json";
import { ConversationFilters } from "../ConversationFilters";
import { Messages } from "../Messages";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

// The wired bar reads its counts over the network; the row is tested pure.
vi.mock("../../hooks/useConversationCounts", () => ({
  useConversationCounts: () => ({ data: undefined }),
}));

/**
 * The patch the coordinator applies adds these keys; until then the catalogue
 * is extended here so the test reads the same copy.
 */
const catalogue = {
  ...fr,
  messages: {
    ...fr.messages,
    tabs: {
      label: "Filtrer les conversations par état de l'annonce",
      all: "Toutes",
      waiting: "En attente de transporteur",
      active: "En cours",
      done: "Terminées",
      none: "Sans annonce",
      emptyTitle: "Aucune conversation dans « {filter} »",
      emptyDescription: "Vos autres conversations sont toujours là, sous un autre filtre.",
      showAll: "Voir toutes les conversations",
    },
  },
} as unknown as Catalogue;

const tr = createTranslator({ locale: "fr", messages: catalogue, onError: () => {} });

const wrap = (ui: React.ReactNode) => (
  <NextIntlClientProvider locale="fr" messages={catalogue}>
    {ui}
  </NextIntlClientProvider>
);

const COUNTS = { all: 16, waiting: 4, active: 2, done: 5, none: 5 };

afterEach(() => window.history.replaceState(null, "", "/"));

describe("ConversationFilters", () => {
  it("offers the five filters, each with its count", () => {
    render(wrap(<ConversationFilters value="all" onChange={() => {}} counts={COUNTS} />));

    expect(screen.getByRole("button", { name: /^Toutes\s*16$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^En attente de transporteur\s*4$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^En cours\s*2$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Terminées\s*5$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Sans annonce\s*5$/ })).toBeInTheDocument();
  });

  it("marks the chosen filter as pressed, and only that one", () => {
    render(wrap(<ConversationFilters value="active" onChange={() => {}} counts={COUNTS} />));

    const pressed = screen
      .getAllByRole("button")
      .filter((button) => button.getAttribute("aria-pressed") === "true");
    expect(pressed).toHaveLength(1);
    expect(pressed[0]).toHaveTextContent("En cours");
  });

  it("reports the filter tapped", () => {
    const onChange = vi.fn();
    render(wrap(<ConversationFilters value="all" onChange={onChange} counts={COUNTS} />));

    fireEvent.click(screen.getByRole("button", { name: /Terminées/ }));
    expect(onChange).toHaveBeenLastCalledWith("done");
  });

  it("still filters while the counts are unknown, with no numbers", () => {
    render(wrap(<ConversationFilters value="all" onChange={() => {}} />));

    expect(screen.getByRole("button", { name: "Terminées" })).toBeInTheDocument();
  });
});

describe("Messages with a state filter in the URL", () => {
  const renderInbox = () =>
    render(
      wrap(
        <Messages
          messages={[]}
          searchQuery=""
          onSearchChange={() => {}}
        />
      )
    );

  it("says nothing is in that state, and offers every conversation", () => {
    window.history.replaceState(null, "", "/messages?filter=done");
    renderInbox();

    expect(
      screen.getByText(tr("messages.tabs.emptyTitle", { filter: "Terminées" }))
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Voir toutes les conversations" }));

    expect(window.location.search).toBe("");
    expect(screen.getByText(tr("messages.empty.title"))).toBeInTheDocument();
  });

  it("restores the filter from the URL, as Back does", () => {
    window.history.replaceState(null, "", "/messages?filter=waiting");
    renderInbox();

    expect(
      screen.getByRole("button", { name: /En attente de transporteur/ })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("reads an unknown filter as « all »", () => {
    window.history.replaceState(null, "", "/messages?filter=bogus");
    renderInbox();

    expect(screen.getByRole("button", { name: /Toutes/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(tr("messages.empty.title"))).toBeInTheDocument();
  });
});
