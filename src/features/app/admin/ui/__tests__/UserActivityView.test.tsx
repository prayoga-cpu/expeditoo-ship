import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/fetcher";

/**
 * « Demandes et messages » (admin_user_management_spec.md §7): every read has
 * its loading, failed and empty branch, each with something to press, and the
 * conversation is read-only — nothing to type in, nothing to send.
 *
 * Copy is echoed as its key: the wording lives in messages/*.json, and what
 * is pinned here is which branch renders and where it leads.
 */

const api = vi.hoisted(() => ({
  summary: vi.fn(),
  requests: vi.fn(),
  offers: vi.fn(),
  conversations: vi.fn(),
  thread: vi.fn(),
}));
const leaveAdmin = vi.hoisted(() => vi.fn());
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }));

vi.mock("../../api/user-activity.api", () => ({ userActivityApi: api }));
vi.mock("@/lib/use-leave-admin-nav", () => ({ useLeaveAdminNav: () => leaveAdmin }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ user: { roles: ["admin"] } }) }));
vi.mock("@/components/ui/page-loader", () => ({
  PageLoader: () => <div data-testid="page-loader" />,
}));
vi.mock("@/components/ui/lottie-loader", () => ({ LottieLoader: () => null }));
vi.mock("next-intl", () => ({
  useLocale: () => "fr",
  useTranslations: (namespace: string) => {
    const t = (key: string, values?: Record<string, unknown>) =>
      `${namespace}.${key}${values ? ` ${JSON.stringify(values)}` : ""}`;
    t.has = () => true;
    return t;
  },
}));

import { UserActivityView, type ActivityTab } from "../user-activity";

const NS = "admin.userActivity";

const job = {
  id: "l1",
  reference: 100042,
  title: "Commode Louis XV",
  pickupCity: "Lyon",
  dropoffCity: "Marseille",
  status: "awarded",
};

const page = <T,>(items: T[], hasMore = false) => ({
  items,
  page: 1,
  pageSize: 50,
  total: items.length,
  hasMore,
});

const request = {
  ...job,
  pickupFrom: "2026-11-25T08:00:00.000Z",
  expiresAt: "2026-11-25T02:00:00.000Z",
  offersCount: 3,
  createdAt: "2026-11-18T10:00:00.000Z",
};

const conversation = {
  id: "c1",
  type: "LISTING",
  lastMessageAt: "2026-11-19T10:00:00.000Z",
  createdAt: "2026-11-18T10:00:00.000Z",
  job,
  others: [{ id: "u2", name: "Jean Transport" }],
  messageCount: 2,
};

const message = (over: Record<string, unknown>) => ({
  id: "m1",
  senderId: "u1",
  senderName: "Nicolas Denis",
  content: "Bonjour, êtes-vous disponible mardi ?",
  hasAttachment: false,
  createdAt: "2026-11-19T09:00:00.000Z",
  offer: null,
  ...over,
});

function renderView(props: { tab?: ActivityTab; conversationId?: string | null } = {}) {
  // The hooks retry a failure that is not a refusal; no need to wait on it here.
  const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  const onBack = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <UserActivityView
        userId="u1"
        tab={props.tab ?? "requests"}
        conversationId={props.conversationId ?? null}
        onBack={onBack}
      />
    </QueryClientProvider>
  );
  return { onBack };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.summary.mockResolvedValue({
    user: { id: "u1", name: "Nicolas Denis", email: "n@example.com" },
    counts: { requests: 1, offers: 0, conversations: 1 },
  });
  api.requests.mockResolvedValue(page([request]));
  api.offers.mockResolvedValue(page([]));
  api.conversations.mockResolvedValue(page([conversation]));
  api.thread.mockResolvedValue({
    conversation,
    // Newest first, as the endpoint answers.
    messages: page([
      message({
        id: "m2",
        senderId: "u2",
        senderName: "Jean Transport",
        content: "Offre de prix",
        createdAt: "2026-11-19T10:00:00.000Z",
        offer: { priceCents: 21_000, status: "pending" },
      }),
      message({}),
    ]),
  });
});

describe("UserActivityView — the page", () => {
  it("waits on the account before drawing anything", () => {
    api.summary.mockReturnValue(new Promise(() => {}));
    renderView();

    expect(screen.getByTestId("page-loader")).toBeInTheDocument();
  });

  it("names the account and says the view is read-only", async () => {
    const { onBack } = renderView();

    expect(await screen.findByText("Nicolas Denis · n@example.com")).toBeInTheDocument();
    expect(screen.getByText(`${NS}.readOnly`)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: `${NS}.back` }));
    expect(onBack).toHaveBeenCalled();
  });

  it("offers a retry and a way back when the read fails", async () => {
    const summary = await api.summary();
    api.summary.mockRejectedValue(new Error("boom"));
    renderView();

    const retry = await screen.findByRole("button", { name: /common\.loadError\.retry/ });
    expect(screen.getByRole("link", { name: `${NS}.backToUsers` })).toHaveAttribute(
      "href",
      "/admin/users"
    );
    api.summary.mockResolvedValue(summary);
    fireEvent.click(retry);

    expect(await screen.findByText("Nicolas Denis · n@example.com")).toBeInTheDocument();
  });

  it("explains, with a way back and no retry, an account it may not read", async () => {
    api.summary.mockRejectedValue(new ApiError("USER_NOT_FOUND", "User not found", 404));
    renderView();

    expect(await screen.findByText(`${NS}.unavailable.title`)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: `${NS}.backToUsers` })).toHaveAttribute(
      "href",
      "/admin/users"
    );
    expect(screen.queryByRole("button", { name: /retry/ })).not.toBeInTheDocument();
  });
});

describe("UserActivityView — a list", () => {
  it("shows a request with its towns and offers, and opens its job outside Admin mode", async () => {
    renderView();

    const list = await screen.findByTestId("activity-requests");
    expect(within(list).getByText("Commode Louis XV")).toBeInTheDocument();
    expect(within(list).getByText("Lyon")).toBeInTheDocument();
    expect(within(list).getByText("Marseille")).toBeInTheDocument();
    expect(within(list).getByText(`${NS}.offersCount {"count":3}`)).toBeInTheDocument();

    fireEvent.click(within(list).getByRole("button", { name: `${NS}.openJob` }));
    expect(leaveAdmin).toHaveBeenCalledWith("/listing/l1");
  });

  it("says a list is empty and leads back to the users", async () => {
    renderView({ tab: "offers" });

    expect(await screen.findByText(`${NS}.offers.emptyTitle`)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: `${NS}.backToUsers` })).toHaveAttribute(
      "href",
      "/admin/users"
    );
  });

  it("offers a retry when a list fails, and reads again", async () => {
    api.requests.mockRejectedValue(new Error("boom"));
    renderView();

    const retry = await screen.findByRole("button", { name: /common\.loadError\.retry/ });
    api.requests.mockResolvedValue(page([request]));
    fireEvent.click(retry);

    expect(await screen.findByTestId("activity-requests")).toBeInTheDocument();
  });

  it("asks for the next page only when there is one", async () => {
    api.requests.mockResolvedValueOnce(page([request], true));
    api.requests.mockResolvedValueOnce({ ...page([{ ...request, id: "l2" }]), page: 2 });
    renderView();

    fireEvent.click(await screen.findByRole("button", { name: `${NS}.loadMore` }));

    await waitFor(() => expect(api.requests).toHaveBeenLastCalledWith("u1", 2));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: `${NS}.loadMore` })).not.toBeInTheDocument()
    );
  });

  it("links a conversation to its messages, by address", async () => {
    renderView({ tab: "conversations" });

    const list = await screen.findByTestId("activity-conversations");
    expect(
      within(list).getByText(`${NS}.conversations.with {"names":"Jean Transport"}`)
    ).toBeInTheDocument();
    expect(
      within(list).getByRole("link", { name: `${NS}.conversations.read` })
    ).toHaveAttribute("href", "/admin/users/u1/activity?conversation=c1");
  });
});

describe("UserActivityView — a conversation", () => {
  it("reads oldest first and shows a thread offer as one line", async () => {
    renderView({ conversationId: "c1" });

    const lines = await screen.findAllByTestId("activity-message");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toHaveTextContent("Bonjour, êtes-vous disponible mardi ?");
    expect(lines[1]).toHaveTextContent(`${NS}.thread.offerLine`);
    expect(lines[1]).toHaveTextContent("210,00");
    expect(lines[1]).not.toHaveTextContent("Offre de prix");
  });

  it("has nothing to type in and nothing to send", async () => {
    renderView({ conversationId: "c1" });
    await screen.findByTestId("activity-thread");

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(document.querySelector("form, input, textarea")).toBeNull();
    // The only buttons lead somewhere: back, and the job page.
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      `${NS}.back`,
      `${NS}.openJob`,
    ]);
  });

  it("offers a retry and the way back to the conversations when the read fails", async () => {
    api.thread.mockRejectedValue(new Error("boom"));
    renderView({ conversationId: "c1" });

    expect(await screen.findByRole("button", { name: /common\.loadError\.retry/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: `${NS}.thread.back` })).toHaveAttribute(
      "href",
      "/admin/users/u1/activity?tab=conversations"
    );
  });

  it("says so, with a way back, when nobody has written yet", async () => {
    api.thread.mockResolvedValue({ conversation, messages: page([]) });
    renderView({ conversationId: "c1" });

    expect(await screen.findByText(`${NS}.thread.emptyTitle`)).toBeInTheDocument();
  });
});
