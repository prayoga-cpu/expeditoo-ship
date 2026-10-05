import { describe, it, expect, vi, beforeEach } from "vitest";

// The transaction handle is a sentinel rather than `{}`, so a case can assert
// that the writes it cares about ran inside the same transaction as the check
// that allowed them (payout_safety_spec.md §4).
const harness = vi.hoisted(() => ({ tx: { label: "tx" } }));

vi.mock("@/db", () => ({
  db: {
    transaction: async (fn: (tx: unknown) => unknown) => await fn(harness.tx),
  },
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
  payoutStanding,
  type ClaimedPayoutFacts,
} from "../withdrawals.service";
import { withdrawalsDal } from "@/server/dal/withdrawals.dal";
import { carriersDal } from "@/server/dal/carriers.dal";
import { userHasRole } from "@/server/dal/users.dal";
import { notificationsService } from "@/server/services/notifications.service";

const request = (over: Record<string, unknown> = {}) => ({
  id: "wd-1",
  carrierId: "carrier-1",
  amountCents: 16_200,
  status: "requested",
  decidedAt: null,
  ...over,
});

/** A payout the request holds, delivered and paid for unless told otherwise. */
const claimed = (over: Partial<ClaimedPayoutFacts & { id: string; amountCents: number }> = {}) => ({
  id: "po-1",
  amountCents: 16_200,
  status: "processing" as const,
  shipmentStatus: "DELIVERED" as const,
  paymentStatus: "captured" as const,
  ...over,
});

const echoIds = async (ids: string[]) => ids.map((id) => ({ id }));

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
    updateOpen: vi.fn(async (id, data) => ({ id, carrierId: "carrier-1", ...data })),
    claimPayouts: vi.fn(echoIds),
    claimedPayouts: vi.fn().mockResolvedValue([claimed()]),
    settlePayouts: vi.fn(echoIds),
    releasePayouts: vi.fn(),
    voidClaimedPayouts: vi.fn(),
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

/** Every payout write a decision can make. None may run on a refusal. */
const noPayoutWrites = () => {
  expect(withdrawalsDal.settlePayouts).not.toHaveBeenCalled();
  expect(withdrawalsDal.releasePayouts).not.toHaveBeenCalled();
  expect(withdrawalsDal.voidClaimedPayouts).not.toHaveBeenCalled();
};

// ========================================
// Whether a claimed payout may still be paid
// ========================================

describe("payoutStanding", () => {
  it.each([
    ["delivered and paid for", {}, "payable"],
    // Written at award before 2.60.0, for a job still on the road. Not final:
    // voiding it would leave the driver unpaid once they deliver.
    ["still in transit", { shipmentStatus: "IN_TRANSIT" }, "undelivered"],
    ["not yet picked up", { shipmentStatus: "ASSIGNED" }, "undelivered"],
    ["on a cancelled run", { shipmentStatus: "CANCELLED" }, "void"],
    ["for a refunded job", { paymentStatus: "refunded" }, "void"],
    ["whose payment row is gone", { paymentStatus: null }, "void"],
    ["already voided by a refund", { status: "cancelled" }, "void"],
    ["already paid", { status: "paid" }, "void"],
  ] as const)("a payout %s is %s", (_label, over, expected) => {
    expect(payoutStanding(claimed(over))).toBe(expected);
  });
});

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
    expect(withdrawalsDal.claimPayouts).toHaveBeenCalledWith(
      ["po-1", "po-2"],
      created.id,
      harness.tx
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
    expect(withdrawalsDal.claimPayouts).not.toHaveBeenCalled();
  });

  it("is not kept when the claim falls short of what was read", async () => {
    // A refund voided one, or a parallel request claimed them first. The
    // frozen total would describe money this request does not hold.
    Object.assign(withdrawalsDal, {
      ...withdrawalsDal,
      availableRows: vi.fn().mockResolvedValue([
        { id: "po-1", amountCents: 16_200 },
        { id: "po-2", amountCents: 9_000 },
      ]),
      claimPayouts: vi.fn().mockResolvedValue([{ id: "po-1" }]),
    });

    expect(await codeFrom(() => withdrawalsService.request("carrier-1"))).toBe(
      "WITHDRAWAL_BALANCE_CHANGED"
    );
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

/** The ways a request stops being payable after the driver asked. */
const UNPAYABLE = [
  ["a payout a refund voided", { status: "cancelled" }],
  ["a refunded job", { paymentStatus: "refunded" }],
  ["a job not yet delivered", { shipmentStatus: "IN_TRANSIT" }],
  ["a cancelled run", { shipmentStatus: "CANCELLED" }],
  ["a payout whose payment is gone", { paymentStatus: null }],
] as const;

describe("withdrawalsService.decide", () => {
  it("refuses anybody who is not an operator", async () => {
    vi.mocked(userHasRole).mockResolvedValue(false);

    expect(
      await codeFrom(() =>
        withdrawalsService.decide("nobody", "wd-1", { action: "approve" })
      )
    ).toBe("FORBIDDEN_NOT_OPERATOR");
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

  it("loses cleanly to a decision that landed first", async () => {
    // Two operators on one request: the second write finds it no longer open
    // rather than turning a paid request into a refused one.
    Object.assign(withdrawalsDal, {
      ...withdrawalsDal,
      updateOpen: vi.fn().mockResolvedValue(undefined),
    });

    expect(
      await codeFrom(() =>
        withdrawalsService.decide("op-1", "wd-1", { action: "reject" })
      )
    ).toBe("WITHDRAWAL_ALREADY_SETTLED");
  });
});

describe("withdrawalsService.decide — the status the operator saw", () => {
  it("refuses nothing a colleague has approved since the row was shown « Demandé »", async () => {
    // Approved — and perhaps already paid by hand — while this queue still
    // showed it waiting: refusing it here would skip the confirmation.
    vi.mocked(withdrawalsDal.getById).mockResolvedValue(request({ status: "approved" }) as never);

    expect(
      await codeFrom(() =>
        withdrawalsService.decide("op-1", "wd-1", { action: "reject", seenStatus: "requested" })
      )
    ).toBe("WITHDRAWAL_STATUS_CHANGED");
    expect(withdrawalsDal.updateOpen).not.toHaveBeenCalled();
    noPayoutWrites();
  });

  it("writes a refusal only from the status seen, and says so when that lost", async () => {
    vi.mocked(withdrawalsDal.getById)
      .mockResolvedValueOnce(request() as never)
      .mockResolvedValueOnce(request({ status: "approved" }) as never);
    vi.mocked(withdrawalsDal.updateOpen).mockResolvedValueOnce(undefined as never);

    expect(
      await codeFrom(() =>
        withdrawalsService.decide("op-1", "wd-1", { action: "reject", seenStatus: "requested" })
      )
    ).toBe("WITHDRAWAL_STATUS_CHANGED");
    expect(withdrawalsDal.updateOpen).toHaveBeenCalledWith(
      "wd-1",
      expect.objectContaining({ status: "rejected" }),
      harness.tx,
      "requested"
    );
  });

  it("lets only one of two racing approvals through", async () => {
    // The other operator approved between this read and this write.
    vi.mocked(withdrawalsDal.getById)
      .mockResolvedValueOnce(request() as never)
      .mockResolvedValueOnce(request({ status: "approved" }) as never);
    vi.mocked(withdrawalsDal.updateOpen).mockResolvedValueOnce(undefined as never);

    expect(
      await codeFrom(() => withdrawalsService.decide("op-1", "wd-1", { action: "approve" }))
    ).toBe("WITHDRAWAL_STATUS_CHANGED");
    expect(withdrawalsDal.updateOpen).toHaveBeenCalledWith(
      "wd-1",
      expect.objectContaining({ status: "approved" }),
      expect.anything(),
      "requested"
    );
    expect(notificationsService.createNotification).not.toHaveBeenCalled();
  });
});

describe("withdrawalsService.decide — approve", () => {
  it("approves without moving any payout — the transfer is made by hand", async () => {
    const updated = await withdrawalsService.decide("op-1", "wd-1", {
      action: "approve",
    });

    expect(updated.status).toBe("approved");
    noPayoutWrites();
  });

  it.each(UNPAYABLE)("refuses a request covering %s", async (_label, over) => {
    vi.mocked(withdrawalsDal.claimedPayouts).mockResolvedValue([claimed(over)]);

    expect(
      await codeFrom(() =>
        withdrawalsService.decide("op-1", "wd-1", { action: "approve" })
      )
    ).toBe("WITHDRAWAL_HAS_INVALID_PAYOUT");
    expect(withdrawalsDal.updateOpen).not.toHaveBeenCalled();
    noPayoutWrites();
  });

  it("refuses a request that holds no payout at all", async () => {
    vi.mocked(withdrawalsDal.claimedPayouts).mockResolvedValue([]);

    expect(
      await codeFrom(() =>
        withdrawalsService.decide("op-1", "wd-1", { action: "approve" })
      )
    ).toBe("WITHDRAWAL_HAS_INVALID_PAYOUT");
  });

  it("refuses a request whose payouts no longer add up to its amount", async () => {
    // The amount is frozen and is what the operator approves. A payout gone
    // from under it is refused, never quietly recomputed.
    vi.mocked(withdrawalsDal.claimedPayouts).mockResolvedValue([
      claimed({ amountCents: 9_000 }),
    ]);

    expect(
      await codeFrom(() =>
        withdrawalsService.decide("op-1", "wd-1", { action: "approve" })
      )
    ).toBe("WITHDRAWAL_HAS_INVALID_PAYOUT");
  });
});

describe("withdrawalsService.decide — mark_paid", () => {
  it("demands a reference before recording a transfer", async () => {
    // A payment recorded with nothing to reconcile it against is worse than
    // one not recorded at all.
    expect(
      await codeFrom(() =>
        withdrawalsService.decide("op-1", "wd-1", { action: "mark_paid" })
      )
    ).toBe("REFERENCE_REQUIRED");
  });

  it("settles the payouts and the request in one transaction", async () => {
    const updated = await withdrawalsService.decide("op-1", "wd-1", {
      action: "mark_paid",
      reference: "VIR-2026-0001",
    });

    expect(updated.status).toBe("paid");
    expect(updated.reference).toBe("VIR-2026-0001");
    expect(withdrawalsDal.claimedPayouts).toHaveBeenCalledWith("wd-1", harness.tx);
    expect(withdrawalsDal.settlePayouts).toHaveBeenCalledWith(["po-1"], harness.tx);
    expect(withdrawalsDal.updateOpen).toHaveBeenCalledWith(
      "wd-1",
      expect.objectContaining({ status: "paid", reference: "VIR-2026-0001" }),
      harness.tx
    );
  });

  it.each(UNPAYABLE)(
    "will not record as paid a request covering %s",
    async (_label, over) => {
      vi.mocked(withdrawalsDal.getById).mockResolvedValue(
        request({ status: "approved" }) as never
      );
      vi.mocked(withdrawalsDal.claimedPayouts).mockResolvedValue([claimed(over)]);

      expect(
        await codeFrom(() =>
          withdrawalsService.decide("op-1", "wd-1", {
            action: "mark_paid",
            reference: "VIR-2026-0001",
          })
        )
      ).toBe("WITHDRAWAL_HAS_INVALID_PAYOUT");
      expect(withdrawalsDal.updateOpen).not.toHaveBeenCalled();
      noPayoutWrites();
    }
  );

  it("rolls back when a refund voids a payout between the check and the write", async () => {
    // The settle moves only `processing` rows, so a payout a refund has just
    // voided is not among them — and the rest is not recorded either.
    vi.mocked(withdrawalsDal.settlePayouts).mockResolvedValue([]);

    expect(
      await codeFrom(() =>
        withdrawalsService.decide("op-1", "wd-1", {
          action: "mark_paid",
          reference: "VIR-2026-0001",
        })
      )
    ).toBe("WITHDRAWAL_HAS_INVALID_PAYOUT");
    expect(withdrawalsDal.updateOpen).not.toHaveBeenCalled();
  });
});

describe("withdrawalsService.decide — reject", () => {
  it("hands back what is still owed and voids the rest, in one transaction", async () => {
    vi.mocked(withdrawalsDal.claimedPayouts).mockResolvedValue([
      claimed({ id: "po-1" }),
      claimed({ id: "po-2", shipmentStatus: "IN_TRANSIT" }),
      claimed({ id: "po-3", paymentStatus: "refunded" }),
    ]);

    const updated = await withdrawalsService.decide("op-1", "wd-1", {
      action: "reject",
      note: "Un des transports a été remboursé",
    });

    expect(updated.status).toBe("rejected");
    // The undelivered one goes back too: it is owed once the job arrives.
    expect(withdrawalsDal.releasePayouts).toHaveBeenCalledWith(
      ["po-1", "po-2"],
      harness.tx
    );
    expect(withdrawalsDal.voidClaimedPayouts).toHaveBeenCalledWith(
      "wd-1",
      harness.tx
    );
    expect(withdrawalsDal.updateOpen).toHaveBeenCalledWith(
      "wd-1",
      expect.objectContaining({ status: "rejected" }),
      harness.tx
    );
  });

  it("releases the whole balance when nothing has changed", async () => {
    await withdrawalsService.decide("op-1", "wd-1", { action: "reject" });

    expect(withdrawalsDal.releasePayouts).toHaveBeenCalledWith(
      ["po-1"],
      harness.tx
    );
  });

  it("can refuse an approved request that can no longer be paid", async () => {
    // Its only way out: while it stays open the driver cannot ask again.
    vi.mocked(withdrawalsDal.getById).mockResolvedValue(
      request({ status: "approved" }) as never
    );
    vi.mocked(withdrawalsDal.claimedPayouts).mockResolvedValue([
      claimed({ status: "cancelled" }),
    ]);

    const updated = await withdrawalsService.decide("op-1", "wd-1", {
      action: "reject",
    });

    expect(updated.status).toBe("rejected");
    expect(withdrawalsDal.releasePayouts).toHaveBeenCalledWith([], harness.tx);
  });
});

describe("withdrawalsService.decide — telling the driver about a refusal", () => {
  const notice = () =>
    vi.mocked(notificationsService.createNotification).mock.calls[0]?.[0];

  it("says a request never approved was refused, in words still true had it been", async () => {
    // An approval can land between `decide`'s read and the refusal, so this
    // notice must not claim there never was one.
    await withdrawalsService.decide("op-1", "wd-1", { action: "reject" });

    expect(notice()).toMatchObject({
      userId: "carrier-1",
      title: "Withdrawal refused",
      message:
        "Your withdrawal request was refused. What you are still owed is available again.",
    });
  });

  it("says an approved withdrawal was cancelled, not that it was never approved", async () => {
    // The driver has already been told "The transfer is being made".
    vi.mocked(withdrawalsDal.getById).mockResolvedValue(
      request({ status: "approved" }) as never
    );

    await withdrawalsService.decide("op-1", "wd-1", { action: "reject" });

    expect(notice()).toMatchObject({
      userId: "carrier-1",
      title: "Withdrawal cancelled",
      message:
        "Your approved withdrawal was cancelled. What you are still owed is available again.",
    });
    expect(notice()?.message).not.toMatch(/not approved/);
  });
});

describe("withdrawalsService.decide — a yes that loses the race", () => {
  /** The request as `decide` read it, then as it stands after the check. */
  const readAs = (first: string, now: string | undefined) =>
    vi
      .mocked(withdrawalsDal.getById)
      .mockResolvedValueOnce(request({ status: first }) as never)
      .mockResolvedValueOnce(
        (now ? request({ status: now }) : undefined) as never
      );

  const yes = (action: "approve" | "mark_paid") =>
    withdrawalsService.decide("op-1", "wd-1", {
      action,
      reference: action === "mark_paid" ? "VIR-2026-0002" : undefined,
    });

  // A refusal unlinks the request's payouts; a recorded transfer marks them
  // paid. Either way the payout check fails before the request row's guard is
  // reached, and the operator must hear that a colleague settled it — not be
  // told to refuse it.
  it.each([
    ["an approval losing to a refusal", "approve", "requested", "rejected", []],
    [
      "an approval losing to a recorded transfer",
      "approve",
      "requested",
      "paid",
      [claimed({ status: "paid" })],
    ],
    ["a recorded transfer losing to a refusal", "mark_paid", "approved", "rejected", []],
    [
      "a recorded transfer losing to another",
      "mark_paid",
      "approved",
      "paid",
      [claimed({ status: "paid" })],
    ],
  ] as const)(
    "%s answers WITHDRAWAL_ALREADY_SETTLED",
    async (_label, action, first, now, rows) => {
      readAs(first, now);
      vi.mocked(withdrawalsDal.claimedPayouts).mockResolvedValue([...rows]);

      expect(await codeFrom(() => yes(action))).toBe(
        "WITHDRAWAL_ALREADY_SETTLED"
      );
      expect(withdrawalsDal.updateOpen).not.toHaveBeenCalled();
      noPayoutWrites();
    }
  );

  it("answers the same when the other transfer lands between the check and the settle", async () => {
    // The settle's `processing` guard finds the rows already paid.
    readAs("approved", "paid");
    vi.mocked(withdrawalsDal.settlePayouts).mockResolvedValue([]);

    expect(await codeFrom(() => yes("mark_paid"))).toBe(
      "WITHDRAWAL_ALREADY_SETTLED"
    );
    expect(withdrawalsDal.updateOpen).not.toHaveBeenCalled();
  });

  it("answers the same when the request is gone", async () => {
    readAs("approved", undefined);
    vi.mocked(withdrawalsDal.claimedPayouts).mockResolvedValue([]);

    expect(await codeFrom(() => yes("mark_paid"))).toBe(
      "WITHDRAWAL_ALREADY_SETTLED"
    );
  });

  it("keeps the refusal reason when the request is still open", async () => {
    // Nobody settled it: a payout really is unpayable, and the operator is
    // told to refuse it. The re-read is the request as committed, after the
    // rolled-back transaction rather than through it.
    readAs("approved", "approved");
    vi.mocked(withdrawalsDal.claimedPayouts).mockResolvedValue([
      claimed({ paymentStatus: "refunded" }),
    ]);

    expect(await codeFrom(() => yes("mark_paid"))).toBe(
      "WITHDRAWAL_HAS_INVALID_PAYOUT"
    );
    expect(withdrawalsDal.getById).toHaveBeenCalledTimes(2);
    expect(withdrawalsDal.getById).toHaveBeenLastCalledWith("wd-1");
  });
});
