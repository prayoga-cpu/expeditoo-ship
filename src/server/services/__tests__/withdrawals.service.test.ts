import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db", () => ({
  db: { transaction: async (fn: (tx: unknown) => unknown) => await fn({}) },
}));
vi.mock("@/server/dal/withdrawals.dal", () => ({ withdrawalsDal: {} }));
vi.mock("@/server/dal/carriers.dal", () => ({ carriersDal: {} }));
vi.mock("@/server/dal/users.dal", () => ({ userHasRole: vi.fn() }));
vi.mock("@/server/services/notifications.service", () => ({
  notificationsService: { createNotification: vi.fn().mockResolvedValue({}) },
}));

import {
  withdrawalsService,
  WithdrawalError,
  MIN_WITHDRAWAL_CENTS,
} from "../withdrawals.service";
import { withdrawalsDal } from "@/server/dal/withdrawals.dal";
import { carriersDal } from "@/server/dal/carriers.dal";
import { userHasRole } from "@/server/dal/users.dal";

const request = (over: Record<string, unknown> = {}) => ({
  id: "wd-1",
  carrierId: "carrier-1",
  amountCents: 16_200,
  status: "requested",
  decidedAt: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(withdrawalsDal, {
    availableFor: vi.fn().mockResolvedValue({ amountCents: 16_200, deliveries: 1 }),
    availableRows: vi
      .fn()
      .mockResolvedValue([{ id: "po-1", amountCents: 16_200 }]),
    findOpenFor: vi.fn().mockResolvedValue(undefined),
    listForCarrier: vi.fn().mockResolvedValue([]),
    listForReview: vi.fn().mockResolvedValue([]),
    create: vi.fn(async (row) => row),
    getById: vi.fn().mockResolvedValue(request()),
    update: vi.fn(async (id, data) => ({ id, carrierId: "carrier-1", ...data })),
    setPayoutWithdrawal: vi.fn(),
    payoutIdsFor: vi.fn().mockResolvedValue(["po-1"]),
    hasAnyPayout: vi.fn().mockResolvedValue(true),
  });
  Object.assign(carriersDal, {
    getByUserId: vi.fn().mockResolvedValue({ id: "c-1", status: "approved" }),
  });
  vi.mocked(userHasRole).mockResolvedValue(true);
});

async function codeFrom(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof WithdrawalError) return error.code;
    throw error;
  }
  throw new Error("expected the call to throw");
}

// ========================================
// Asking
// ========================================

describe("withdrawalsService.request", () => {
  it("claims every available payout and freezes the total", async () => {
    Object.assign(withdrawalsDal, {
      ...withdrawalsDal,
      availableRows: vi.fn().mockResolvedValue([
        { id: "po-1", amountCents: 16_200 },
        { id: "po-2", amountCents: 9_000 },
      ]),
    });

    const created = await withdrawalsService.request("carrier-1");

    expect(created.amountCents).toBe(25_200);
    expect(withdrawalsDal.setPayoutWithdrawal).toHaveBeenCalledWith(
      ["po-1", "po-2"],
      created.id,
      "processing",
      expect.anything()
    );
  });

  it("refuses a second request while one is open", async () => {
    // Two live requests against one balance is how the same money gets
    // approved twice.
    Object.assign(withdrawalsDal, {
      ...withdrawalsDal,
      findOpenFor: vi.fn().mockResolvedValue(request()),
    });

    expect(await codeFrom(() => withdrawalsService.request("carrier-1"))).toBe(
      "WITHDRAWAL_ALREADY_OPEN"
    );
  });

  it("refuses when there is nothing earned", async () => {
    Object.assign(withdrawalsDal, {
      ...withdrawalsDal,
      availableRows: vi.fn().mockResolvedValue([]),
    });

    expect(await codeFrom(() => withdrawalsService.request("carrier-1"))).toBe(
      "NOTHING_TO_WITHDRAW"
    );
  });

  it("refuses below the minimum, and leaves the balance alone", async () => {
    Object.assign(withdrawalsDal, {
      ...withdrawalsDal,
      availableRows: vi
        .fn()
        .mockResolvedValue([{ id: "po-1", amountCents: MIN_WITHDRAWAL_CENTS - 1 }]),
    });

    expect(await codeFrom(() => withdrawalsService.request("carrier-1"))).toBe(
      "BELOW_MINIMUM"
    );
    expect(withdrawalsDal.setPayoutWithdrawal).not.toHaveBeenCalled();
  });
});

// ========================================
// Balance
// ========================================

describe("withdrawalsService.getBalance", () => {
  it("will not offer a request while one is already open", async () => {
    Object.assign(withdrawalsDal, {
      ...withdrawalsDal,
      findOpenFor: vi.fn().mockResolvedValue(request()),
    });

    const balance = await withdrawalsService.getBalance("carrier-1");

    expect(balance.canRequest).toBe(false);
    expect(balance.openRequest).not.toBeNull();
  });

  it("will not offer a request below the minimum", async () => {
    Object.assign(withdrawalsDal, {
      ...withdrawalsDal,
      availableFor: vi.fn().mockResolvedValue({ amountCents: 500, deliveries: 1 }),
    });

    expect((await withdrawalsService.getBalance("carrier-1")).canRequest).toBe(
      false
    );
  });

  it("reports no earnings for a driver with no payout row", async () => {
    Object.assign(withdrawalsDal, {
      ...withdrawalsDal,
      availableFor: vi.fn().mockResolvedValue({ amountCents: 0, deliveries: 0 }),
      hasAnyPayout: vi.fn().mockResolvedValue(false),
    });

    expect((await withdrawalsService.getBalance("carrier-1")).hasEverEarned).toBe(
      false
    );
  });

  it("still counts a claimed payout as earned, though nothing is available", async () => {
    // The distinction the empty state hangs off: `deliveries` counts only
    // unclaimed `scheduled` rows, so a driver waiting on a withdrawal reports
    // zero available and would otherwise read as somebody who never worked.
    Object.assign(withdrawalsDal, {
      ...withdrawalsDal,
      availableFor: vi.fn().mockResolvedValue({ amountCents: 0, deliveries: 0 }),
      hasAnyPayout: vi.fn().mockResolvedValue(true),
    });

    const balance = await withdrawalsService.getBalance("carrier-1");

    expect(balance.availableCents).toBe(0);
    expect(balance.deliveries).toBe(0);
    expect(balance.hasEverEarned).toBe(true);
  });

  it("passes the application status through, and null when there is none", async () => {
    expect((await withdrawalsService.getBalance("carrier-1")).carrierStatus).toBe(
      "approved"
    );

    Object.assign(carriersDal, {
      getByUserId: vi.fn().mockResolvedValue(undefined),
    });

    expect(
      (await withdrawalsService.getBalance("nobody")).carrierStatus
    ).toBeNull();
  });
});

// ========================================
// Deciding
// ========================================

describe("withdrawalsService.decide", () => {
  it("refuses anybody who is not an operator", async () => {
    vi.mocked(userHasRole).mockResolvedValue(false);

    expect(
      await codeFrom(() =>
        withdrawalsService.decide("nobody", "wd-1", { action: "approve" })
      )
    ).toBe("FORBIDDEN_NOT_OPERATOR");
  });

  it("approves without moving any payout — the transfer is made by hand", async () => {
    const updated = await withdrawalsService.decide("op-1", "wd-1", {
      action: "approve",
    });

    expect(updated.status).toBe("approved");
    expect(withdrawalsDal.setPayoutWithdrawal).not.toHaveBeenCalled();
  });

  it("demands a reference before recording a transfer", async () => {
    // A payment recorded with nothing to reconcile it against is worse than
    // one not recorded at all.
    expect(
      await codeFrom(() =>
        withdrawalsService.decide("op-1", "wd-1", { action: "mark_paid" })
      )
    ).toBe("REFERENCE_REQUIRED");
  });

  it("marks the payouts paid once the transfer is recorded", async () => {
    const updated = await withdrawalsService.decide("op-1", "wd-1", {
      action: "mark_paid",
      reference: "VIR-2026-0001",
    });

    expect(updated.status).toBe("paid");
    expect(updated.reference).toBe("VIR-2026-0001");
    expect(withdrawalsDal.setPayoutWithdrawal).toHaveBeenCalledWith(
      ["po-1"],
      "wd-1",
      "paid"
    );
  });

  it("releases the money back to available when refused", async () => {
    const updated = await withdrawalsService.decide("op-1", "wd-1", {
      action: "reject",
      note: "Bank details missing",
    });

    expect(updated.status).toBe("rejected");
    expect(withdrawalsDal.setPayoutWithdrawal).toHaveBeenCalledWith(
      ["po-1"],
      null,
      "scheduled"
    );
  });

  it("will not re-decide something already settled", async () => {
    Object.assign(withdrawalsDal, {
      ...withdrawalsDal,
      getById: vi.fn().mockResolvedValue(request({ status: "paid" })),
    });

    expect(
      await codeFrom(() =>
        withdrawalsService.decide("op-1", "wd-1", { action: "approve" })
      )
    ).toBe("WITHDRAWAL_ALREADY_SETTLED");
  });
});
