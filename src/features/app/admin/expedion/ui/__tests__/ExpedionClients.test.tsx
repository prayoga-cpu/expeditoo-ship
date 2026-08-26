import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../../../../../messages/en.json";
import fr from "../../../../../../../messages/fr.json";
import type {
  ExpedionClient,
  ExpedionClientQuote,
} from "../../api/clients.api";

import { ExpedionClientDialog } from "../ExpedionClientDialog";
import { ExpedionClientsTable } from "../ExpedionClientsTable";

/**
 * Renders both screens against the real message catalogues, in both locales.
 *
 * Several keys here are built by template — `quoteStatus.${quote.status}`, one
 * per value of `expedionQuoteStatusEnum` — so neither TypeScript nor a grep can
 * tell you they exist. next-intl does not throw on a missing key: it renders
 * the key path and calls `onError`, so a typo ships as
 * `admin.expedionClients.quoteStatus.picked_up` sitting in the dialog. The
 * fixtures below therefore cover **every** status, and asserting `onError` was
 * never called is what makes that a failing test rather than visible debris.
 */

const CLIENT: ExpedionClient = {
  ownerId: "vqAREuF5p8O1LqsFZrEVpv08RvL2",
  name: "Camille Roux",
  email: "camille@example.fr",
  phone: "+33600000000",
  city: "Lyon",
  quoteCount: 10,
  paidCount: 4,
  deliveredCount: 2,
  paidValueCents: 240_000,
  firstSeenAt: "2026-01-02T10:00:00.000Z",
  lastSeenAt: "2026-06-02T10:00:00.000Z",
  account: null,
};

/** The other branch of every optional: no name, no contact, and an account. */
const SPARSE: ExpedionClient = {
  ...CLIENT,
  ownerId: "dev:short",
  name: null,
  email: null,
  phone: null,
  city: null,
  paidValueCents: 0,
  account: {
    id: "user-9",
    name: "Camille",
    email: "camille@example.fr",
    banned: true,
  },
};

/** One quote per status, so every templated `quoteStatus.*` key is reached. */
const QUOTES: ExpedionClientQuote[] = (
  [
    "pending",
    "awaiting_confirmation",
    "quoted",
    "accepted",
    "paid",
    "assigned",
    "escalated",
    "picked_up",
    "delivered",
    "cancelled",
  ] as const
).map((status, index) => ({
  id: `q-${index}`,
  quoteNumber: `D-${index}`,
  bordereauNumber: index % 2 === 0 ? `BX-${index}` : null,
  status,
  paymentStatus: "paid",
  acceptedPriceCents: index % 3 === 0 ? null : 12_000,
  pickupCity: "Paris",
  deliveryCity: index % 2 === 0 ? "Lyon" : null,
  listingId: null,
  createdAt: "2026-06-02T10:00:00.000Z",
}));

const list = {
  data: {
    clients: [CLIENT, SPARSE],
    total: 4_592,
    page: 1,
    pageSize: 25,
    totalPages: 184,
  },
  isLoading: false,
  isError: false,
};

const detail = {
  data: { client: CLIENT, quotes: QUOTES },
  isLoading: false,
  isError: false,
};

vi.mock("../../hooks/useExpedionClients", () => ({
  useExpedionClients: () => list,
  useExpedionClient: () => detail,
}));

function renderWith(
  locale: "en" | "fr",
  messages: typeof en | typeof fr,
  node: React.ReactNode
) {
  const onError = vi.fn<(error: Error) => void>();
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      onError={onError}
      timeZone="Europe/Paris"
    >
      {node}
    </NextIntlClientProvider>
  );
  return onError;
}

beforeEach(() => {
  list.data = {
    clients: [CLIENT, SPARSE],
    total: 4_592,
    page: 1,
    pageSize: 25,
    totalPages: 184,
  };
  list.isLoading = false;
  list.isError = false;
});

describe("ExpedionClientsTable", () => {
  it.each([
    ["en", en, "Expedion clients"],
    ["fr", fr, "Clients Expedion"],
  ] as const)("resolves every message key in %s", (locale, messages, title) => {
    const onError = renderWith(locale, messages, <ExpedionClientsTable />);

    expect(
      onError.mock.calls.map(([e]) => e.message),
      "next-intl reported a message problem"
    ).toEqual([]);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(title);
  });

  it("counts owners, not quotes, and says how many pages that is", () => {
    renderWith("en", en, <ExpedionClientsTable />);

    // The whole reason this screen exists: 4,592 people, none of whom the
    // users table can show.
    expect(screen.getByText("4,592 clients")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 184")).toBeInTheDocument();
  });

  it("labels a client who never gave a name, rather than leaving it blank", () => {
    renderWith("en", en, <ExpedionClientsTable />);

    expect(screen.getByText("No name given")).toBeInTheDocument();
  });

  it("says plainly when there is no Expeditoo account to act on", () => {
    renderWith("en", en, <ExpedionClientsTable />);

    // The majority case. Rendered as a stated fact, not an empty cell.
    expect(screen.getByText("None")).toBeInTheDocument();
  });

  it("links a client who does have an account to that account", () => {
    renderWith("en", en, <ExpedionClientsTable />);

    expect(screen.getByRole("link", { name: /Open account/ })).toHaveAttribute(
      "href",
      "/admin/users?search=camille%40example.fr"
    );
  });

  it("shows the empty state, not a blank table, when nothing matches", () => {
    list.data = { clients: [], total: 0, page: 1, pageSize: 25, totalPages: 1 };

    renderWith("en", en, <ExpedionClientsTable />);

    expect(screen.getByText("No Expedion clients")).toBeInTheDocument();
  });

  it("shows an error state when the list call fails", () => {
    list.isError = true;

    renderWith("en", en, <ExpedionClientsTable />);

    expect(
      screen.getByText("Could not load the client list")
    ).toBeInTheDocument();
  });
});

describe("ExpedionClientDialog", () => {
  it.each([
    ["en", en],
    ["fr", fr],
  ] as const)(
    "resolves every quote status in %s, including the templated ones",
    (locale, messages) => {
      const onError = renderWith(
        locale,
        messages,
        <ExpedionClientDialog ownerId={CLIENT.ownerId} onOpenChange={() => {}} />
      );

      expect(
        onError.mock.calls.map(([e]) => e.message),
        "next-intl reported a message problem"
      ).toEqual([]);
    }
  );

  it("renders one line per quote", () => {
    renderWith(
      "en",
      en,
      <ExpedionClientDialog ownerId={CLIENT.ownerId} onOpenChange={() => {}} />
    );

    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getAllByRole("listitem")).toHaveLength(QUOTES.length);
  });

  it("explains why there is nothing to manage for an account-less client", () => {
    renderWith(
      "en",
      en,
      <ExpedionClientDialog ownerId={CLIENT.ownerId} onOpenChange={() => {}} />
    );

    expect(
      screen.getByText(/signs in through Expedion only/)
    ).toBeInTheDocument();
  });

  it("stays closed when no owner is selected", () => {
    renderWith(
      "en",
      en,
      <ExpedionClientDialog ownerId={null} onOpenChange={() => {}} />
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
