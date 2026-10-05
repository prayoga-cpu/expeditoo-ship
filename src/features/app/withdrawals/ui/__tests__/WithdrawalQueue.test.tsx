import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../../../../messages/en.json";
import { ApiError } from "@/lib/fetcher";
import type { ReviewRow } from "../../api/withdrawals.api";

/**
 * payout_safety_spec.md §4 — the operator's way out of a request that can no
 * longer be paid, being told why, and being asked before refusing one that
 * may already have been transferred.
 *
 * The hooks are real and the client API is mocked, so what is exercised is
 * the whole path from a button to the toast the server's code selects.
 */

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("sonner", () => ({ toast }));
vi.mock("@/components/ui/page-loader", () => ({
  PageLoader: () => <div data-testid="loader" />,
}));
vi.mock("../../api/withdrawals.api", () => ({
  withdrawalsApi: {
    balance: vi.fn(),
    request: vi.fn(),
    review: vi.fn(),
    decide: vi.fn(),
  },
}));

import { withdrawalsApi } from "../../api/withdrawals.api";
import { WithdrawalQueue } from "../WithdrawalQueue";

/**
 * The refusal's copy reaches the catalogues with this release's message
 * patch, so the suite brings its own: what is asserted is that the code
 * selects its own message rather than the generic one, not the wording.
 * The confirmation's fixture keeps the real copy's two placeholders, so what
 * is asserted there is that the dialog names this request's amount and driver.
 */
const INVALID_PAYOUT = "fixture — refuse this request";
const REFUSE_APPROVED = {
  title: "fixture — refuse an approved withdrawal?",
  description: "fixture — {amount} back to {name}; only if never sent",
  keep: "fixture — keep it approved",
  confirm: "fixture — refuse, transfer not sent",
};
const messages = {
  ...en,
  withdrawals: {
    ...en.withdrawals,
    errors: {
      ...en.withdrawals.errors,
      WITHDRAWAL_HAS_INVALID_PAYOUT: INVALID_PAYOUT,
    },
    refuseApproved: REFUSE_APPROVED,
  },
};

const row = (over: Partial<ReviewRow> = {}): ReviewRow => ({
  id: "wd-1",
  carrierId: "carrier-1",
  amountCents: 16_200,
  currency: "eur",
  status: "requested",
  reference: null,
  decisionNote: null,
  createdAt: "2026-10-01T09:00:00.000Z",
  decidedAt: null,
  paidAt: null,
  carrierName: "Jean Dupont",
  carrierEmail: "jean@example.com",
  ...over,
});

function renderQueue() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider
        locale="en"
        messages={messages}
        timeZone="Europe/Paris"
      >
        <WithdrawalQueue />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("WithdrawalQueue", () => {
  it("offers Refuse on an approved request, and sends a rejection once confirmed", async () => {
    // A refund landing after approval makes the request unpayable, and while
    // it stays open the driver cannot ask for anything else.
    vi.mocked(withdrawalsApi.review).mockResolvedValue([
      row({ status: "approved" }),
    ]);
    vi.mocked(withdrawalsApi.decide).mockResolvedValue(
      row({ status: "rejected" })
    );
    renderQueue();

    const refuse = await screen.findByRole("button", {
      name: en.withdrawals.reject,
    });
    // Approving is still for requested rows only.
    expect(
      screen.queryByRole("button", { name: en.withdrawals.approve })
    ).not.toBeInTheDocument();

    fireEvent.click(refuse);
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: REFUSE_APPROVED.confirm })
    );

    await waitFor(() =>
      expect(withdrawalsApi.decide).toHaveBeenCalledWith("wd-1", {
        action: "reject",
        seenStatus: "approved",
      })
    );
  });

  it("asks before refusing an approved request, and says what refusing does", async () => {
    // The transfer may already have been made by hand. Refused, the amount
    // goes back to the balance and the next request pays it a second time.
    vi.mocked(withdrawalsApi.review).mockResolvedValue([
      row({ status: "approved" }),
    ]);
    renderQueue();

    fireEvent.click(
      await screen.findByRole("button", { name: en.withdrawals.reject })
    );

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(REFUSE_APPROVED.title)).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "fixture — 162,00 € back to Jean Dupont; only if never sent"
      )
    ).toBeInTheDocument();
    expect(withdrawalsApi.decide).not.toHaveBeenCalled();
  });

  it("keeps an approved request when the operator backs out", async () => {
    vi.mocked(withdrawalsApi.review).mockResolvedValue([
      row({ status: "approved" }),
    ]);
    renderQueue();

    fireEvent.click(
      await screen.findByRole("button", { name: en.withdrawals.reject })
    );
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: REFUSE_APPROVED.keep,
      })
    );

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    );
    expect(withdrawalsApi.decide).not.toHaveBeenCalled();
  });

  it("still offers both answers on a requested row", async () => {
    vi.mocked(withdrawalsApi.review).mockResolvedValue([row()]);
    renderQueue();

    expect(
      await screen.findByRole("button", { name: en.withdrawals.approve })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: en.withdrawals.reject })
    ).toBeInTheDocument();
  });

  it("refuses a requested row at once — no transfer is made before approval", async () => {
    vi.mocked(withdrawalsApi.review).mockResolvedValue([row()]);
    vi.mocked(withdrawalsApi.decide).mockResolvedValue(
      row({ status: "rejected" })
    );
    renderQueue();

    fireEvent.click(
      await screen.findByRole("button", { name: en.withdrawals.reject })
    );

    // Sent with what the operator saw: a colleague's approval since turns
    // this into WITHDRAWAL_STATUS_CHANGED rather than an unconfirmed refusal.
    await waitFor(() =>
      expect(withdrawalsApi.decide).toHaveBeenCalledWith("wd-1", {
        action: "reject",
        seenStatus: "requested",
      })
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("tells the operator why a request cannot be paid, not just that it failed", async () => {
    vi.mocked(withdrawalsApi.review).mockResolvedValue([row()]);
    vi.mocked(withdrawalsApi.decide).mockRejectedValue(
      new ApiError(
        "WITHDRAWAL_HAS_INVALID_PAYOUT",
        "This withdrawal covers a job that was refunded",
        409
      )
    );
    renderQueue();

    fireEvent.click(
      await screen.findByRole("button", { name: en.withdrawals.approve })
    );

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(INVALID_PAYOUT));
    expect(toast.error).not.toHaveBeenCalledWith(en.withdrawals.errors.generic);
  });
});

// ========================================
// A colleague decided first — payout_safety_spec.md §4
// ========================================

describe("WithdrawalQueue — a request that moved on meanwhile", () => {
  // The server: the request moves on (a colleague's decision) after this
  // queue read it, and the queue's filter is applied as the API applies it.
  let dbStatus: ReviewRow["status"] = "requested";
  const serverAnswers = (code: string) =>
    vi.mocked(withdrawalsApi.decide).mockRejectedValue(new ApiError(code, "moved on", 409));
  const badge = () => document.querySelector('[data-slot="badge"]')?.textContent;

  beforeEach(() => {
    dbStatus = "requested";
    vi.mocked(withdrawalsApi.review).mockImplementation(async (status?: string) => {
      const all = [row({ status: dbStatus })];
      return status ? all.filter((r) => r.status === status) : all;
    });
  });

  it("sends Approve with the status the operator saw", async () => {
    vi.mocked(withdrawalsApi.decide).mockResolvedValue(row({ status: "approved" }));
    renderQueue();

    fireEvent.click(await screen.findByRole("button", { name: en.withdrawals.approve }));

    await waitFor(() =>
      expect(withdrawalsApi.decide).toHaveBeenCalledWith("wd-1", {
        action: "approve",
        seenStatus: "requested",
      })
    );
  });

  it("shows a refusal bounced by a colleague's approval where the request now is", async () => {
    serverAnswers("WITHDRAWAL_STATUS_CHANGED");
    renderQueue();
    const refuse = await screen.findByRole("button", { name: en.withdrawals.reject });
    dbStatus = "approved";

    fireEvent.click(refuse);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(en.withdrawals.errors.WITHDRAWAL_STATUS_CHANGED)
    );
    // « Tous », not the « Demandé » list it just left: approved, and asking first.
    await waitFor(() => expect(badge()).toBe(en.withdrawals.status.approved));
    expect(withdrawalsApi.review).toHaveBeenLastCalledWith(undefined);
    fireEvent.click(screen.getByRole("button", { name: en.withdrawals.reject }));
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
  });

  it("reads the queue again for a request settled meanwhile", async () => {
    serverAnswers("WITHDRAWAL_ALREADY_SETTLED");
    renderQueue();
    const refuse = await screen.findByRole("button", { name: en.withdrawals.reject });
    dbStatus = "paid";

    fireEvent.click(refuse);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(en.withdrawals.errors.WITHDRAWAL_ALREADY_SETTLED)
    );
    await waitFor(() => expect(withdrawalsApi.review).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(en.withdrawals.queueEmpty)).toBeInTheDocument();
  });

  it("reads nothing again for a refusal that is about the request itself", async () => {
    serverAnswers("WITHDRAWAL_HAS_INVALID_PAYOUT");
    renderQueue();

    fireEvent.click(await screen.findByRole("button", { name: en.withdrawals.reject }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(INVALID_PAYOUT));
    expect(withdrawalsApi.review).toHaveBeenCalledTimes(1);
  });
});
