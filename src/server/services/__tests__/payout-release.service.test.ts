import { beforeEach, describe, expect, it, vi } from "vitest";

/** Automatic payout, after the hold — client_feedback_2026_10_29_spec.md §N3, §N4. */

const m = vi.hoisted(() => ({
  releasable: vi.fn(),
  claimForRelease: vi.fn(),
  markReleased: vi.fn(),
  releaseClaim: vi.fn(),
  retrieve: vi.fn(),
  transfer: vi.fn(),
  paid: vi.fn(),
}));
vi.mock("@/server/dal/withdrawals.dal", () => ({
  withdrawalsDal: {
    releasable: m.releasable,
    claimForRelease: m.claimForRelease,
    markReleased: m.markReleased,
    releaseClaim: m.releaseClaim,
  },
}));
vi.mock("@/lib/stripe", () => ({
  stripe: {
    paymentIntents: { retrieve: m.retrieve },
    transfers: { create: m.transfer },
  },
}));
vi.mock("@/server/services/payout-notices.service", () => ({
  payoutNoticesService: { paid: m.paid },
}));

import { PAYOUT_HOLD_HOURS, payoutReleaseService } from "../payout-release.service";

const NOW = new Date("2026-11-02T12:00:00.000Z");
const due = (over: Record<string, unknown> = {}) => ({
  id: "po-1",
  carrierId: "driver-1",
  shipmentId: "shp-1",
  amountCents: 16_200,
  currency: "eur",
  paymentIntentId: "pi_123",
  transferGroup: "shipment_shp-1",
  destination: "acct_driver",
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  m.releasable.mockResolvedValue([due()]);
  m.claimForRelease.mockResolvedValue({ id: "po-1" });
  m.retrieve.mockResolvedValue({ latest_charge: "ch_123" });
  m.transfer.mockResolvedValue({ id: "tr_123" });
  m.markReleased.mockResolvedValue({ id: "po-1" });
  m.paid.mockResolvedValue(undefined);
});

describe("payoutReleaseService.releaseDue", () => {
  it("asks only for payouts delivered at least the hold ago", async () => {
    await payoutReleaseService.releaseDue(NOW);
    expect(m.releasable).toHaveBeenCalledWith(NOW, PAYOUT_HOLD_HOURS * 3_600_000, 50);
  });

  it("transfers to the driver's account, funded from the client's charge, once", async () => {
    const result = await payoutReleaseService.releaseDue(NOW);

    expect(m.transfer).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 16_200,
        destination: "acct_driver",
        source_transaction: "ch_123",
        transfer_group: "shipment_shp-1",
      }),
      { idempotencyKey: "payout_release_po-1" }
    );
    expect(m.markReleased).toHaveBeenCalledWith("po-1", "tr_123");
    expect(m.paid).toHaveBeenCalledWith("driver-1", 16_200, "tr_123");
    expect(result).toEqual({ released: 1, skipped: 0, failed: 0 });
  });

  it("skips a payout a withdrawal request claimed meanwhile", async () => {
    m.claimForRelease.mockResolvedValue(undefined);
    const result = await payoutReleaseService.releaseDue(NOW);
    expect(m.transfer).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
  });

  it("puts a refused transfer back in the balance, never marking it failed", async () => {
    m.transfer.mockRejectedValue(new Error("insufficient_funds"));
    const result = await payoutReleaseService.releaseDue(NOW);
    expect(m.releaseClaim).toHaveBeenCalledWith("po-1", "insufficient_funds");
    expect(m.markReleased).not.toHaveBeenCalled();
    expect(result.failed).toBe(1);
  });

  it("does nothing when nothing is due — the state production is in until Connect and the crons run", async () => {
    m.releasable.mockResolvedValue([]);
    expect(await payoutReleaseService.releaseDue(NOW)).toEqual({ released: 0, skipped: 0, failed: 0 });
    expect(m.transfer).not.toHaveBeenCalled();
  });
});
