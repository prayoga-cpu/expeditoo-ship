import { render, screen, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../../../../messages/en.json";

// Covers docs/specs/feedback_spec.md §5 and §8.

const { queue, triage } = vi.hoisted(() => ({
  queue: { current: {} as Record<string, unknown> },
  triage: vi.fn(),
}));

vi.mock("../../hooks/useFeedback", () => ({
  useFeedbackQueue: () => queue.current,
  useTriageFeedback: () => ({ mutate: triage }),
}));

import { FeedbackConsole } from "../FeedbackConsole";

function ticket(overrides = {}) {
  return {
    id: "fb_abcdefgh",
    type: "bug",
    surface: "home",
    description: "It broke",
    screenshotUrls: [],
    status: "OPEN",
    createdAt: "2026-09-10T10:00:00.000Z",
    priority: "medium",
    devNote: null,
    pathname: "/home",
    appVersion: "2.37.2",
    locale: "fr",
    userRole: "shipper",
    reporter: {
      id: "u1",
      name: "Ada",
      email: "ada@example.com",
      accountExists: true,
    },
    resolvedAt: null,
    updatedAt: "2026-09-10T10:00:00.000Z",
    ...overrides,
  };
}

function renderConsole() {
  const onError = vi.fn<(error: Error) => void>();
  render(
    <NextIntlClientProvider locale="en" messages={en} onError={onError}>
      <FeedbackConsole />
    </NextIntlClientProvider>
  );
  return onError;
}

beforeEach(() => {
  vi.clearAllMocks();
  queue.current = {
    items: [ticket()],
    meta: {
      total: 1,
      limit: 25,
      offset: 0,
      counts: {
        OPEN: 3,
        IN_PROGRESS: 0,
        NEEDS_REVIEW: 2,
        RESOLVED: 7,
        ARCHIVED: 0,
      },
    },
    isLoading: false,
    isError: false,
  };
});

/** The five status tiles, in enum order — the only buttons that toggle. */
function statusTiles(): HTMLElement[] {
  return screen
    .getAllByRole("button")
    .filter((el) => el.hasAttribute("aria-pressed"));
}

describe("FeedbackConsole", () => {
  it("shows the server's counts on all five tiles, zeroes included", () => {
    const onError = renderConsole();

    // Selected by their toggle semantics, not by label text: "Open" also
    // appears as a value in the per-row status dropdown.
    const tiles = statusTiles();
    expect(tiles).toHaveLength(5);

    // In enum declaration order, which is triage order.
    ["3", "0", "2", "7", "0"].forEach((count, i) => {
      expect(within(tiles[i]).getByText(count)).toBeInTheDocument();
    });
    expect(onError.mock.calls.map(([e]) => e.message)).toEqual([]);
  });

  it("toggles a status filter on and back off from the same tile", () => {
    renderConsole();
    const open = statusTiles()[0];

    expect(open).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(open);
    expect(statusTiles()[0]).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(statusTiles()[0]);
    expect(statusTiles()[0]).toHaveAttribute("aria-pressed", "false");
  });

  it("says so when it fails, instead of rendering a blank page", () => {
    // CLAUDE.md §Gotchas 9 — the withdrawals 500 hid behind exactly this.
    queue.current = { ...queue.current, isError: true, items: [] };
    renderConsole();

    expect(
      screen.getByText("Feedback could not be loaded. Refresh to try again.")
    ).toBeInTheDocument();
  });

  it("distinguishes an empty queue from one the filters emptied", () => {
    queue.current = { ...queue.current, items: [] };
    renderConsole();
    expect(screen.getByText("No feedback")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search feedback…"), {
      target: { value: "nothing matches this" },
    });
    expect(screen.getByText("No feedback matches")).toBeInTheDocument();
  });

  it("invites an internal note when there is none yet", () => {
    renderConsole();
    expect(
      screen.getByRole("button", { name: "Add an internal note" })
    ).toBeInTheDocument();
  });

  it("shows an existing note rather than the invitation", () => {
    queue.current = {
      ...queue.current,
      items: [ticket({ devNote: "known issue, fix queued" })],
    };
    renderConsole();

    expect(screen.getByText("known issue, fix queued")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add an internal note" })
    ).not.toBeInTheDocument();
  });

  it("marks a ticket from a deleted account as one", () => {
    queue.current = {
      ...queue.current,
      items: [
        ticket({
          reporter: {
            id: null,
            name: "Ada",
            email: "ada@example.com",
            accountExists: false,
          },
        }),
      ],
    };
    renderConsole();

    expect(screen.getByText(/deleted account/)).toBeInTheDocument();
  });
});
