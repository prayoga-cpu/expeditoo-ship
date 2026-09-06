import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/server/dal/shipments.dal", () => ({ shipmentsDal: {} }));
vi.mock("@/server/dal/listings.dal", () => ({ listingsDal: {} }));
vi.mock("@/server/dal/offers.dal", () => ({ offersDal: {} }));
vi.mock("@/server/dal/users.dal", () => ({ userHasRole: vi.fn() }));
vi.mock("@/server/services/notifications.service", () => ({
  notificationsService: { createNotification: vi.fn().mockResolvedValue({}) },
}));
vi.mock("@/server/services/offers.service", () => ({
  offersService: {
    reopenForRebid: vi.fn().mockResolvedValue(undefined),
    expirePendingOffers: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock("@/server/services/payments.service", () => ({
  paymentsService: {
    refundForJob: vi.fn().mockResolvedValue({}),
    cancelPayoutForShipment: vi.fn().mockResolvedValue(null),
  },
}));
vi.mock("@/server/services/expedion-bridge.service", () => ({
  expedionBridgeService: {
    onJobCancelled: vi.fn().mockResolvedValue(undefined),
    onAwardWithdrawn: vi.fn().mockResolvedValue(undefined),
    onQuoteCancelled: vi.fn().mockResolvedValue(undefined),
  },
  notifyExpedion: vi.fn(),
}));
vi.mock("@/server/services/expedion.service", () => ({
  expedionService: { getQuote: vi.fn() },
}));

import { shipmentCancellationService } from "../shipment-cancellation.service";
import { shipmentsDal } from "@/server/dal/shipments.dal";
import { listingsDal } from "@/server/dal/listings.dal";
import { offersDal } from "@/server/dal/offers.dal";
import { userHasRole } from "@/server/dal/users.dal";
import { notificationsService } from "@/server/services/notifications.service";
import { offersService } from "@/server/services/offers.service";
import { paymentsService } from "@/server/services/payments.service";
import { expedionBridgeService } from "@/server/services/expedion-bridge.service";
import { expedionService } from "@/server/services/expedion.service";

// ========================================
// Fixtures
// ========================================

const SHIPPER = { userId: "shipper-1" };
const CARRIER = { userId: "carrier-1" };
const DRIVER = { userId: "driver-1" };
const OPERATOR = { userId: "op-1", isOperator: true };

const ownership = (over: Record<string, unknown> = {}) => ({
  id: "ship-1",
  listingId: "job-1",
  // Which award this run belongs to. A listing can carry more than one
  // shipment, so both verbs check they are stopping the live one.
  offerId: "offer-1",
  shipperId: "shipper-1",
  carrierId: "carrier-1",
  driverId: "driver-1",
  status: "ASSIGNED",
  ...over,
});

const listing = (over: Record<string, unknown> = {}) => ({
  id: "job-1",
  shipperId: "shipper-1",
  title: "Sofa to Lyon",
  status: "awarded",
  origin: "direct",
  acceptedOfferId: "offer-1",
  ...over,
});

async function codeFrom(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return "NO_ERROR";
  } catch (error) {
    return (error as { code?: string }).code ?? "NO_CODE";
  }
}

/** What was written onto the shipment row itself. */
const cancelPatch = () => vi.mocked(shipmentsDal.cancel).mock.calls[0][1];

/** The metadata JSON hung on the timeline event. */
const eventMeta = () =>
  JSON.parse(
    (vi.mocked(shipmentsDal.createEvent).mock.calls[0][0].metadata ??
      "{}") as string
  );

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(shipmentsDal, {
    getOwnership: vi.fn().mockResolvedValue(ownership()),
    getById: vi.fn().mockResolvedValue({ id: "ship-1", status: "CANCELLED" }),
    getByListingId: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue({ id: "ship-1", status: "CANCELLED" }),
    createEvent: vi.fn().mockResolvedValue({}),
  });
  Object.assign(listingsDal, {
    getById: vi.fn().mockResolvedValue(listing()),
    update: vi.fn().mockResolvedValue({}),
    getShipmentByOfferId: vi
      .fn()
      .mockResolvedValue({ id: "ship-1", status: "ASSIGNED" }),
  });
  Object.assign(offersDal, {
    listByListing: vi
      .fn()
      .mockResolvedValue([
        { id: "offer-1", carrierId: "carrier-1", status: "accepted" },
        { id: "offer-2", carrierId: "carrier-2", status: "rejected" },
      ]),
    updateStatus: vi.fn().mockResolvedValue({}),
  });
  vi.mocked(paymentsService.refundForJob).mockResolvedValue({} as never);
  vi.mocked(userHasRole).mockResolvedValue(true);
});

// ========================================
// The requester calls the job off
// ========================================

describe("cancelJob — the requester's verb", () => {
  const asShipper = (over = {}) =>
    shipmentCancellationService.cancelJob(
      "ship-1",
      { category: "no_longer_needed", reason: "plans changed", ...over },
      { kind: "session", viewer: SHIPPER }
    );

  it("ends the job and gives the money back", async () => {
    await asShipper();

    // Keyed on the listing, not the shipment: after a withdrawal the shipment
    // is dead and the money is still the client's.
    expect(paymentsService.refundForJob).toHaveBeenCalledWith("job-1");
    expect(cancelPatch()).toMatchObject({
      side: "requester",
      category: "no_longer_needed",
      reason: "plans changed",
      byUserId: "shipper-1",
      byRef: null,
    });
  });

  it("closes the listing and clears the award", async () => {
    await asShipper();

    expect(offersService.expirePendingOffers).toHaveBeenCalledWith("job-1");
    expect(offersDal.updateStatus).toHaveBeenCalledWith("offer-1", "rejected");
    expect(listingsDal.update).toHaveBeenCalledWith("job-1", {
      status: "cancelled",
      acceptedOfferId: null,
      offersCount: 0,
    });
  });

  it("does not put the job back on the board", async () => {
    // The whole difference between the two verbs.
    await asShipper();

    expect(offersService.reopenForRebid).not.toHaveBeenCalled();
  });

  it("tells the transporter, who would otherwise drive to a dead job", async () => {
    await asShipper();

    const told = vi
      .mocked(notificationsService.createNotification)
      .mock.calls.map((c) => c[0].userId);
    expect(told).toContain("carrier-1");
    expect(told).toContain("driver-1");
  });

  it("refuses once the goods are collected, and refunds nothing", async () => {
    vi.mocked(shipmentsDal.getOwnership).mockResolvedValue(
      ownership({ status: "PICKED_UP" }) as never
    );

    expect(await codeFrom(asShipper)).toBe("CANCEL_REQUIRES_SUPPORT");
    expect(paymentsService.refundForJob).not.toHaveBeenCalled();
  });

  it("refuses a delivered run outright", async () => {
    vi.mocked(shipmentsDal.getOwnership).mockResolvedValue(
      ownership({ status: "DELIVERED" }) as never
    );

    expect(await codeFrom(asShipper)).toBe("INVALID_STATUS_TRANSITION");
  });

  it("refuses a reason that belongs to the other side", async () => {
    expect(await codeFrom(() => asShipper({ category: "vehicle_breakdown" }))).toBe(
      "CATEGORY_NOT_FOR_SIDE"
    );
  });

  it("absorbs a repeat instead of refunding twice and then failing", async () => {
    // Before this, the second POST fired the refund *first* and only then
    // discovered the run was already off, so a refund attempt went out under a
    // 409.
    vi.mocked(shipmentsDal.getOwnership).mockResolvedValue(
      ownership({ status: "CANCELLED" }) as never
    );

    const result = await asShipper();

    expect(result.alreadyCancelled).toBe(true);
    expect(paymentsService.refundForJob).not.toHaveBeenCalled();
    expect(shipmentsDal.cancel).not.toHaveBeenCalled();
  });

  it("refuses a stranger", async () => {
    expect(
      await codeFrom(() =>
        shipmentCancellationService.cancelJob(
          "ship-1",
          { category: "no_longer_needed" },
          { kind: "session", viewer: { userId: "nobody" } }
        )
      )
    ).toBe("FORBIDDEN");
  });
});

// ========================================
// A transporter may not end someone else's job
// ========================================

describe("cancelJob — the transporter is sent next door", () => {
  it("names the verb that works instead of refusing flatly", async () => {
    expect(
      await codeFrom(() =>
        shipmentCancellationService.cancelJob(
          "ship-1",
          { category: "vehicle_breakdown" },
          { kind: "session", viewer: CARRIER }
        )
      )
    ).toBe("USE_WITHDRAW_ENDPOINT");
  });

  it("moves no money on the way to refusing", async () => {
    await codeFrom(() =>
      shipmentCancellationService.cancelJob(
        "ship-1",
        { category: "vehicle_breakdown" },
        { kind: "session", viewer: CARRIER }
      )
    );

    expect(paymentsService.refundForJob).not.toHaveBeenCalled();
    expect(listingsDal.update).not.toHaveBeenCalled();
  });
});

// ========================================
// The transporter comes off the job
// ========================================

describe("withdrawFromJob — the transporter's verb", () => {
  const asCarrier = (over = {}) =>
    shipmentCancellationService.withdrawFromJob(
      "ship-1",
      { category: "vehicle_breakdown", reason: "engine died", ...over },
      CARRIER
    );

  it("puts the job back on the board rather than killing it", async () => {
    await asCarrier();

    expect(offersService.reopenForRebid).toHaveBeenCalledWith(
      "job-1",
      "offer-1",
      ["offer-2"],
      { winnerStatus: "withdrawn", markReopened: true }
    );
    // The line that made a broken van destroy a paid client's delivery.
    expect(listingsDal.update).not.toHaveBeenCalledWith(
      "job-1",
      expect.objectContaining({ status: "cancelled" })
    );
  });

  it("records which side walked", async () => {
    await asCarrier();

    expect(cancelPatch()).toMatchObject({
      side: "transporter",
      category: "vehicle_breakdown",
      byUserId: "carrier-1",
    });
  });

  it("gives the client their money back rather than holding it", async () => {
    // Nobody should hold a client's money for a job that has no driver.
    await asCarrier();

    expect(paymentsService.refundForJob).toHaveBeenCalledWith("job-1");
  });

  it("tells the client, and the rivals whose bids are live again", async () => {
    await asCarrier();

    const told = vi
      .mocked(notificationsService.createNotification)
      .mock.calls.map((c) => c[0]);
    expect(told.map((n) => n.userId)).toContain("shipper-1");
    expect(
      told.find((n) => n.userId === "carrier-2")?.type
    ).toBe("job_reopened");
  });

  it("does not tell the Expedion system account, which nobody reads", async () => {
    // `notifications.user_id` is a NOT NULL foreign key, so writing to the
    // system account succeeds and reaches nobody. That client gets an SMS.
    vi.mocked(listingsDal.getById).mockResolvedValue(
      listing({ origin: "expedion", shipperId: "expedion-system" }) as never
    );
    vi.mocked(shipmentsDal.getOwnership).mockResolvedValue(
      ownership({ shipperId: "expedion-system" }) as never
    );

    await asCarrier();

    const told = vi
      .mocked(notificationsService.createNotification)
      .mock.calls.map((c) => c[0].userId);
    expect(told).not.toContain("expedion-system");
  });

  it("refuses an employed driver: the award is their carrier's", async () => {
    expect(
      await codeFrom(() =>
        shipmentCancellationService.withdrawFromJob(
          "ship-1",
          { category: "driver_unavailable" },
          DRIVER
        )
      )
    ).toBe("FORBIDDEN_DRIVER_CANNOT_WITHDRAW");
  });

  it("refuses the requester, who has a different verb", async () => {
    expect(
      await codeFrom(() =>
        shipmentCancellationService.withdrawFromJob(
          "ship-1",
          { category: "no_longer_needed" },
          SHIPPER
        )
      )
    ).toBe("FORBIDDEN");
  });

  it("refuses once the cargo is loaded, and moves no money", async () => {
    vi.mocked(shipmentsDal.getOwnership).mockResolvedValue(
      ownership({ status: "PICKED_UP" }) as never
    );

    expect(await codeFrom(asCarrier)).toBe("WITHDRAW_AFTER_PICKUP");
    expect(paymentsService.refundForJob).not.toHaveBeenCalled();
    expect(offersService.reopenForRebid).not.toHaveBeenCalled();
  });
});

// ========================================
// The operator's lanes
// ========================================

describe("the operator", () => {
  it("can end a run that is already on the road", async () => {
    // Impossible for anyone before this: the staff carve-out was defeated by a
    // transition table with no CANCELLED edge out of IN_TRANSIT.
    vi.mocked(shipmentsDal.getOwnership).mockResolvedValue(
      ownership({ status: "IN_TRANSIT" }) as never
    );

    await shipmentCancellationService.cancelJob(
      "ship-1",
      { category: "support_resolution", reason: "goods refused" },
      { kind: "session", viewer: OPERATOR }
    );

    expect(cancelPatch()).toMatchObject({ side: "operator" });
    expect(paymentsService.refundForJob).toHaveBeenCalledWith("job-1");
  });

  it("revokes an award through the one re-board path", async () => {
    await shipmentCancellationService.revokeAward("op-1", "job-1", "wrong driver");

    expect(offersService.reopenForRebid).toHaveBeenCalled();
    expect(cancelPatch()).toMatchObject({ side: "operator" });
  });

  it("is the only one who can revoke", async () => {
    vi.mocked(userHasRole).mockResolvedValue(false);

    expect(
      await codeFrom(() =>
        shipmentCancellationService.revokeAward("shipper-1", "job-1")
      )
    ).toBe("FORBIDDEN_NOT_OPERATOR");
  });

  it("cannot revoke a job that was never awarded", async () => {
    vi.mocked(listingsDal.getById).mockResolvedValue(
      listing({ status: "open" }) as never
    );

    expect(
      await codeFrom(() => shipmentCancellationService.revokeAward("op-1", "job-1"))
    ).toBe("LISTING_NOT_AWARDED");
  });

  it("cannot revoke once the goods have been collected", async () => {
    vi.mocked(shipmentsDal.getOwnership).mockResolvedValue(
      ownership({ status: "IN_TRANSIT" }) as never
    );

    expect(
      await codeFrom(() => shipmentCancellationService.revokeAward("op-1", "job-1"))
    ).toBe("WITHDRAW_AFTER_PICKUP");
  });
});

// ========================================
// The Expedion system account
// ========================================

describe("the borrowed seat", () => {
  beforeEach(() => {
    vi.mocked(listingsDal.getById).mockResolvedValue(
      listing({ origin: "expedion", shipperId: "expedion-system" }) as never
    );
    vi.mocked(shipmentsDal.getOwnership).mockResolvedValue(
      ownership({ shipperId: "expedion-system" }) as never
    );
  });

  it("refuses a session sitting in it with no operator role", async () => {
    // An admin may impersonate the system account, and `partyFor` resolves
    // `shipper` before `staff` — so without this, a borrowed session is one
    // click from cancelling a real client's paid job as the machine.
    expect(
      await codeFrom(() =>
        shipmentCancellationService.cancelJob(
          "ship-1",
          { category: "no_longer_needed" },
          { kind: "session", viewer: { userId: "expedion-system" } }
        )
      )
    ).toBe("CANCEL_SYSTEM_ACCOUNT_FORBIDDEN");
  });

  it("lets a real operator through, as an operator", async () => {
    await shipmentCancellationService.cancelJob(
      "ship-1",
      { category: "support_resolution" },
      {
        kind: "session",
        viewer: { userId: "expedion-system", isAdmin: true },
      }
    );

    expect(cancelPatch()).toMatchObject({ side: "operator" });
  });
});

// ========================================
// Money that is not ours to give back
// ========================================

describe("the refund", () => {
  it("still cancels when the money was taken in Expedion", async () => {
    // `REFUND_NOT_LOCAL` is the expected answer there, not a failure. The
    // refund-owed record is the bridge's job.
    vi.mocked(paymentsService.refundForJob).mockRejectedValue(
      Object.assign(new Error("REFUND_NOT_LOCAL"), { code: "REFUND_NOT_LOCAL" })
    );

    await shipmentCancellationService.cancelJob(
      "ship-1",
      { category: "no_longer_needed" },
      { kind: "session", viewer: SHIPPER }
    );

    expect(shipmentsDal.cancel).toHaveBeenCalled();
    expect(eventMeta().refundFailed).toBeUndefined();
  });

  it("still cancels when Stripe fails — but says so on the record", async () => {
    // The swallow is deliberate: a job nobody is doing must not stay live
    // because Stripe was unreachable. What it must not do is hide.
    vi.mocked(paymentsService.refundForJob).mockRejectedValue(
      new Error("Stripe is down")
    );

    await shipmentCancellationService.cancelJob(
      "ship-1",
      { category: "no_longer_needed" },
      { kind: "session", viewer: SHIPPER }
    );

    expect(shipmentsDal.cancel).toHaveBeenCalled();
    expect(eventMeta().refundFailed).toBe(true);
  });
});

// ========================================
// The requester who has no account
// ========================================

describe("cancelForQuote — the Expedion client's own lane", () => {
  const quote = (over: Record<string, unknown> = {}) => ({
    id: "quote-1",
    firebaseUid: "fb-1",
    listingId: "job-1",
    status: "escalated",
    ...over,
  });

  beforeEach(() => {
    vi.mocked(expedionService.getQuote).mockResolvedValue(quote() as never);
  });

  it("cancels the live shipment as the requester, by reference", async () => {
    // They have no `user` row, so the actor is a ref — the same pair
    // `shipment_confirmations` uses and for the same reason.
    vi.mocked(shipmentsDal.getByListingId).mockResolvedValue({
      id: "ship-1",
      status: "ASSIGNED",
    } as never);

    await shipmentCancellationService.cancelForQuote(
      "quote-1",
      { userId: "fb-1", isAdmin: false } as never,
      { category: "no_longer_needed" }
    );

    expect(cancelPatch()).toMatchObject({
      side: "requester",
      byUserId: null,
      byRef: "fb-1",
    });
  });

  it("kills the listing and the quote when no driver was ever awarded", async () => {
    vi.mocked(shipmentsDal.getByListingId).mockResolvedValue(undefined as never);

    await shipmentCancellationService.cancelForQuote(
      "quote-1",
      { userId: "fb-1", isAdmin: false } as never,
      { category: "date_changed" }
    );

    expect(listingsDal.update).toHaveBeenCalledWith(
      "job-1",
      expect.objectContaining({ status: "cancelled" })
    );
    expect(expedionBridgeService.onQuoteCancelled).toHaveBeenCalledWith(
      expect.objectContaining({ quoteId: "quote-1", side: "requester" })
    );
  });

  it("cancels a quote that never reached the board at all", async () => {
    vi.mocked(expedionService.getQuote).mockResolvedValue(
      quote({ listingId: null, status: "paid" }) as never
    );

    await shipmentCancellationService.cancelForQuote(
      "quote-1",
      { userId: "fb-1", isAdmin: false } as never,
      { category: "no_longer_needed" }
    );

    expect(expedionBridgeService.onQuoteCancelled).toHaveBeenCalled();
    expect(shipmentsDal.cancel).not.toHaveBeenCalled();
  });

  it("refuses a reason from the wrong side", async () => {
    expect(
      await codeFrom(() =>
        shipmentCancellationService.cancelForQuote(
          "quote-1",
          { userId: "fb-1", isAdmin: false } as never,
          { category: "vehicle_breakdown" }
        )
      )
    ).toBe("CATEGORY_NOT_FOR_SIDE");
  });
});

// ========================================
// The run being stopped must be the live one
// ========================================
//
// A listing can carry more than one shipment, and could before this feature: a
// declined charge sends `compensateFailedAward` to re-open the job while
// leaving the shipment `commitAward` created alive and PENDING. Stopping that
// orphan would refund a *different* carrier's award and un-award their offer.

describe("an orphaned shipment", () => {
  const orphan = () =>
    vi.mocked(shipmentsDal.getOwnership).mockResolvedValue(
      ownership({ offerId: "offer-old" }) as never
    );

  it("cannot be withdrawn from, and moves no money", async () => {
    orphan();

    expect(
      await codeFrom(() =>
        shipmentCancellationService.withdrawFromJob(
          "ship-1",
          { category: "vehicle_breakdown" },
          CARRIER
        )
      )
    ).toBe("SHIPMENT_NOT_CURRENT");
    expect(paymentsService.refundForJob).not.toHaveBeenCalled();
    expect(offersService.reopenForRebid).not.toHaveBeenCalled();
  });

  it("cannot close the listing a different award is holding", async () => {
    orphan();

    expect(
      await codeFrom(() =>
        shipmentCancellationService.cancelJob(
          "ship-1",
          { category: "no_longer_needed" },
          { kind: "session", viewer: SHIPPER }
        )
      )
    ).toBe("SHIPMENT_NOT_CURRENT");
    expect(listingsDal.update).not.toHaveBeenCalled();
  });
});

// ========================================
// A retry finishes the work
// ========================================
//
// The verbs are four writes across four tables and are not one transaction. A
// run that flipped to CANCELLED and then failed on the listing or the bridge
// used to be unrepairable — every recovery route lands back on the same
// shipment, and "already cancelled" returned early.

describe("repairing a half-applied cancellation", () => {
  beforeEach(() => {
    vi.mocked(shipmentsDal.getOwnership).mockResolvedValue(
      ownership({ status: "CANCELLED" }) as never
    );
  });

  it("closes a listing left awarded behind a cancelled run", async () => {
    const result = await shipmentCancellationService.cancelJob(
      "ship-1",
      { category: "no_longer_needed" },
      { kind: "session", viewer: SHIPPER }
    );

    expect(result.alreadyCancelled).toBe(true);
    expect(listingsDal.update).toHaveBeenCalledWith(
      "job-1",
      expect.objectContaining({ status: "cancelled" })
    );
    // Not a second time.
    expect(paymentsService.refundForJob).not.toHaveBeenCalled();
    expect(shipmentsDal.cancel).not.toHaveBeenCalled();
  });

  it("re-boards a job left awarded behind a cancelled run", async () => {
    const result = await shipmentCancellationService.withdrawFromJob(
      "ship-1",
      { category: "vehicle_breakdown" },
      CARRIER
    );

    expect(result.alreadyCancelled).toBe(true);
    expect(offersService.reopenForRebid).toHaveBeenCalled();
    expect(paymentsService.refundForJob).not.toHaveBeenCalled();
  });

  it("re-fires the Expedion refund-owed record, which is the only one there is", async () => {
    // `refundForJob` refuses that money outright, so the write-back carrying
    // `refundIssued: false` is the whole record that the client is owed
    // anything. Losing it to one failed call must not be permanent.
    vi.mocked(listingsDal.getById).mockResolvedValue(
      listing({ origin: "expedion", shipperId: "expedion-system" }) as never
    );

    await shipmentCancellationService.cancelJob(
      "ship-1",
      { category: "support_resolution" },
      { kind: "session", viewer: OPERATOR }
    );

    expect(expedionBridgeService.onJobCancelled).toHaveBeenCalled();
  });
});

// ========================================
// The photo gate has nothing to say here
// ========================================

describe("evidence", () => {
  it("never asks for a photo to stop a run", async () => {
    // `PHOTO_GATED_TRANSITIONS` deliberately omits CANCELLED, and this is the
    // live path now that the status route refuses the value. The service does
    // not import the photos service at all — asserted structurally, so adding
    // a gate here would have to be a deliberate act.
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync(
        "src/server/services/shipment-cancellation.service.ts",
        "utf8"
      )
    );

    expect(source).not.toContain("shipment-photos.service");
    expect(source).not.toContain("hasStagePhoto");
  });
});

// ========================================
// An operator answering for a client is not the client
// ========================================

describe("cancelForQuote — who actually acted", () => {
  const quote = () => ({
    id: "quote-1",
    firebaseUid: "fb-1",
    listingId: "job-1",
    status: "escalated",
  });

  beforeEach(() => {
    vi.mocked(expedionService.getQuote).mockResolvedValue(quote() as never);
    vi.mocked(shipmentsDal.getByListingId).mockResolvedValue({
      id: "ship-1",
      status: "ASSIGNED",
    } as never);
  });

  it("records an admin's cancellation as the operator's, not the client's", async () => {
    // `getQuote` waves an admin through for *any* quote, so without this the
    // client's own screen would read "Annulée par le client" for something an
    // operator did to them. `attestForQuote` draws the same line.
    await shipmentCancellationService.cancelForQuote(
      "quote-1",
      { userId: "op-1", isAdmin: true } as never,
      { category: "support_resolution" }
    );

    expect(cancelPatch()).toMatchObject({
      side: "operator",
      byRef: "op-1",
      byUserId: null,
    });
  });

  it("gives an operator the operator vocabulary on that lane", async () => {
    // Refused before: the lane hard-coded `requester`, so `fraud_or_abuse` and
    // `support_resolution` were unreachable from it.
    expect(
      await codeFrom(() =>
        shipmentCancellationService.cancelForQuote(
          "quote-1",
          { userId: "fb-1", isAdmin: false } as never,
          { category: "support_resolution" }
        )
      )
    ).toBe("CATEGORY_NOT_FOR_SIDE");
  });

  it("hands back a projection, never the shipment row", async () => {
    // The raw row carries the winning driver's bid — what the platform pays
    // out, not what this client paid Expedion, so the difference is the margin
    // — plus both street addresses and the internal party ids.
    const result = await shipmentCancellationService.cancelForQuote(
      "quote-1",
      { userId: "fb-1", isAdmin: false } as never,
      { category: "no_longer_needed" }
    );

    expect(result).toEqual({
      quoteId: "quote-1",
      shipmentId: "ship-1",
      cancelled: true,
      alreadyCancelled: false,
    });
  });
});

// ========================================
// Being taken off a job you were planning around
// ========================================

describe("revokeAward tells the carrier", () => {
  it("notifies the transporter whose job an operator just took back", async () => {
    // A straight regression otherwise: the deleted `offersService.revokeAward`
    // sent the winner "A job was taken back", and routing it through the shared
    // verb dropped that. They are planning around a real pickup time.
    await shipmentCancellationService.revokeAward("op-1", "job-1", "wrong driver");

    const told = vi
      .mocked(notificationsService.createNotification)
      .mock.calls.map((c) => c[0]);
    expect(told.find((n) => n.userId === "carrier-1")?.type).toBe(
      "shipment_withdrawn"
    );
  });

  it("does not tell a carrier who withdrew themselves — they know", async () => {
    await shipmentCancellationService.withdrawFromJob(
      "ship-1",
      { category: "vehicle_breakdown" },
      CARRIER
    );

    const told = vi
      .mocked(notificationsService.createNotification)
      .mock.calls.map((c) => c[0]);
    expect(told.find((n) => n.userId === "carrier-1")).toBeUndefined();
  });
});

// ========================================
// The driver's ledger
// ========================================

describe("the payout behind a cancelled run", () => {
  it("is voided, because it was scheduled at award and counts as withdrawable", async () => {
    // The Stripe webhook schedules the payout at capture, and capture is award
    // time since payment-at-booking — so a job cancelled before anyone drives
    // anywhere already carries a `scheduled` payout that
    // `withdrawalsDal.availableFor` sums into the driver's balance.
    await shipmentCancellationService.cancelJob(
      "ship-1",
      { category: "no_longer_needed" },
      { kind: "session", viewer: SHIPPER }
    );

    expect(paymentsService.cancelPayoutForShipment).toHaveBeenCalledWith(
      "ship-1"
    );
  });
});
