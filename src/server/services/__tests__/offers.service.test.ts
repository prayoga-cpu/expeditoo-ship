import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db", () => ({
  db: {
    // Runs the callback immediately with a stub tx: the transaction boundary
    // itself is a database guarantee, so what is asserted here is the sequence
    // of writes inside it, not the atomicity.
    transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb({})),
  },
}));
vi.mock("@/server/dal/offers.dal", () => ({ offersDal: {} }));
vi.mock("@/server/dal/listings.dal", () => ({ listingsDal: {} }));
vi.mock("@/server/dal/carriers.dal", () => ({ carriersDal: {} }));
vi.mock("@/server/dal/users.dal", () => ({ userHasRole: vi.fn() }));
vi.mock("@/server/services/notifications.service", () => ({
  notificationsService: { createNotification: vi.fn().mockResolvedValue({}) },
}));
vi.mock("@/server/services/payments.service", () => ({
  paymentsService: {
    chargeForShipment: vi.fn(),
    refundForShipment: vi.fn().mockResolvedValue({}),
  },
}));
vi.mock("@/server/services/expedion-bridge.service", () => ({
  expedionBridgeService: { onOfferAccepted: vi.fn() },
  notifyExpedion: vi.fn(),
}));

import { offersService, OfferError } from "../offers.service";
import { offersDal } from "@/server/dal/offers.dal";
import { listingsDal } from "@/server/dal/listings.dal";
import { carriersDal } from "@/server/dal/carriers.dal";
import { userHasRole } from "@/server/dal/users.dal";
import { paymentsService } from "@/server/services/payments.service";
import {
  TIME_SLOTS,
  slotInterval,
  toDayString,
  type TimeSlot,
} from "@/lib/availability-window";

// ========================================
// Fixtures
// ========================================

const HOUR = 60 * 60 * 1000;
const soon = (ms: number) => new Date(Date.now() + ms);

const listing = (over: Record<string, unknown> = {}) => ({
  id: "job-1",
  shipperId: "shipper-1",
  status: "open",
  title: "Sofa to Lyon",
  weightKg: 80,
  lengthCm: 200,
  widthCm: 90,
  heightCm: 80,
  budgetCents: 20_000,
  isFlexible: false,
  pickupFrom: soon(24 * HOUR),
  pickupUntil: soon(32 * HOUR),
  dropoffFrom: soon(56 * HOUR),
  dropoffUntil: soon(64 * HOUR),
  expiresAt: soon(18 * HOUR),
  acceptedOfferId: null,
  pickupLat: 48.86,
  pickupLng: 2.35,
  pickupAddress: "1 rue de Rivoli",
  dropoffLat: 45.76,
  dropoffLng: 4.84,
  dropoffAddress: "2 place Bellecour",
  shipper: { stripeCustomerId: "cus_1" },
  ...over,
});

const vehicle = (over: Record<string, unknown> = {}) => ({
  id: "veh-1",
  carrierId: "carrier-co-1",
  maxWeightKg: 1000,
  maxLengthCm: 400,
  maxWidthCm: 200,
  maxHeightCm: 200,
  ...over,
});

const TZ = new Date().getTimezoneOffset();

/**
 * The first `(day, time of day)` pair overlapping a window.
 *
 * The listing fixture's window is relative to the moment the suite runs, so a
 * hardcoded "25 August, morning" would pass or fail depending on the hour of
 * the day — and the vocabulary has no slot between 22:00 and 06:00, so the
 * right slot is not always the obvious one either.
 */
function slotWithin(from: Date, until: Date): { day: string; slot: TimeSlot } {
  for (let ahead = 0; ahead <= 1; ahead++) {
    const day = toDayString(new Date(from.getTime() + ahead * 24 * HOUR));
    for (const slot of TIME_SLOTS) {
      const { start, end } = slotInterval(day, slot, TZ);
      if (start < until && end > from) return { day, slot };
    }
  }
  throw new Error("no slot overlaps this window");
}

/** A slot days clear of the fixture's window, whatever the clock says. */
const slotOutside = () => ({
  day: toDayString(soon(80 * HOUR)),
  slot: "morning" as TimeSlot,
});

const offerInput = (over: Record<string, unknown> = {}) => ({
  vehicleId: "veh-1",
  priceCents: 18_000,
  slots: [slotWithin(soon(24 * HOUR), soon(32 * HOUR))],
  deliveryLeadDays: 0,
  tzOffset: TZ,
  message: "Can do this easily",
  ...over,
});

function approvedCarrier() {
  vi.mocked(carriersDal).getByUserId = vi
    .fn()
    .mockResolvedValue({ id: "carrier-co-1", status: "approved" });
}

beforeEach(() => {
  vi.clearAllMocks();
  approvedCarrier();
  Object.assign(carriersDal, {
    getVehicleById: vi.fn().mockResolvedValue(vehicle()),
  });
  Object.assign(listingsDal, {
    getById: vi.fn().mockResolvedValue(listing()),
  });
  Object.assign(offersDal, {
    getLiveByCarrierAndListing: vi.fn().mockResolvedValue(undefined),
    create: vi.fn(async (row) => row),
    createSlots: vi.fn(async (rows) => rows),
    incrementListingOffersCount: vi.fn(),
  });
});

/** Runs `fn` and returns the OfferError code it threw. */
async function codeFrom(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof OfferError) return error.code;
    throw error;
  }
  throw new Error("expected the call to throw");
}

// ========================================
// Submit — docs/specs/offers_engine_spec.md §3
// ========================================

describe("offersService.submitOffer", () => {
  it("creates a pending offer and bumps the job's offer count", async () => {
    const offer = await offersService.submitOffer("carrier-1", "job-1", offerInput());

    expect(offer.status).toBe("pending");
    expect(offer.priceCents).toBe(18_000);
    expect(offersDal.incrementListingOffersCount).toHaveBeenCalledWith(
      "job-1",
      1,
      expect.anything()
    );
  });

  it("rejects a carrier whose application is not approved", async () => {
    Object.assign(carriersDal, {
      getByUserId: vi.fn().mockResolvedValue({ id: "c", status: "submitted" }),
    });

    expect(await codeFrom(() => offersService.submitOffer("carrier-1", "job-1", offerInput())))
      .toBe("CARRIER_NOT_APPROVED");
  });

  it("rejects a user with no carrier account at all", async () => {
    Object.assign(carriersDal, { getByUserId: vi.fn().mockResolvedValue(undefined) });

    expect(await codeFrom(() => offersService.submitOffer("nobody", "job-1", offerInput())))
      .toBe("CARRIER_NOT_APPROVED");
  });

  it("stops a shipper bidding on their own job", async () => {
    expect(await codeFrom(() => offersService.submitOffer("shipper-1", "job-1", offerInput())))
      .toBe("CANNOT_BID_OWN_LISTING");
  });

  it("rejects a vehicle belonging to another carrier", async () => {
    Object.assign(carriersDal, {
      getVehicleById: vi.fn().mockResolvedValue(vehicle({ carrierId: "someone-else" })),
    });

    expect(await codeFrom(() => offersService.submitOffer("carrier-1", "job-1", offerInput())))
      .toBe("VEHICLE_NOT_OWNED");
  });

  it("refuses to bid on a job that is not open", async () => {
    Object.assign(listingsDal, {
      getById: vi.fn().mockResolvedValue(listing({ status: "awarded" })),
    });

    expect(await codeFrom(() => offersService.submitOffer("carrier-1", "job-1", offerInput())))
      .toBe("LISTING_NOT_OPEN");
  });

  it("refuses to bid after the bidding window closed", async () => {
    Object.assign(listingsDal, {
      getById: vi.fn().mockResolvedValue(listing({ expiresAt: soon(-HOUR) })),
    });

    expect(await codeFrom(() => offersService.submitOffer("carrier-1", "job-1", offerInput())))
      .toBe("LISTING_EXPIRED");
  });

  it("allows only one live offer per carrier per job", async () => {
    Object.assign(offersDal, {
      getLiveByCarrierAndListing: vi.fn().mockResolvedValue({ id: "existing" }),
    });

    expect(await codeFrom(() => offersService.submitOffer("carrier-1", "job-1", offerInput())))
      .toBe("OFFER_ALREADY_EXISTS");
  });

  it("rejects a vehicle that cannot carry the weight", async () => {
    Object.assign(carriersDal, {
      getVehicleById: vi.fn().mockResolvedValue(vehicle({ maxWeightKg: 50 })),
    });

    expect(await codeFrom(() => offersService.submitOffer("carrier-1", "job-1", offerInput())))
      .toBe("VEHICLE_CAPACITY_WEIGHT");
  });

  it("rejects a vehicle too small for the load", async () => {
    Object.assign(carriersDal, {
      getVehicleById: vi.fn().mockResolvedValue(vehicle({ maxLengthCm: 100 })),
    });

    expect(await codeFrom(() => offersService.submitOffer("carrier-1", "job-1", offerInput())))
      .toBe("VEHICLE_CAPACITY_DIMENSIONS");
  });

  it("ignores dimensions the shipper never gave", async () => {
    Object.assign(listingsDal, {
      getById: vi
        .fn()
        .mockResolvedValue(listing({ lengthCm: null, widthCm: null, heightCm: null })),
    });
    Object.assign(carriersDal, {
      getVehicleById: vi.fn().mockResolvedValue(vehicle({ maxLengthCm: 10 })),
    });

    await expect(
      offersService.submitOffer("carrier-1", "job-1", offerInput())
    ).resolves.toBeDefined();
  });

  it("rejects a slot outside the shipper's window", async () => {
    expect(
      await codeFrom(() =>
        offersService.submitOffer(
          "carrier-1",
          "job-1",
          offerInput({ slots: [slotOutside()] })
        )
      )
    ).toBe("PICKUP_OUTSIDE_WINDOW");
  });

  it("permits a slot outside the window when the job is flexible", async () => {
    Object.assign(listingsDal, {
      getById: vi.fn().mockResolvedValue(listing({ isFlexible: true })),
    });

    await expect(
      offersService.submitOffer(
        "carrier-1",
        "job-1",
        offerInput({ slots: [slotOutside()] })
      )
    ).resolves.toBeDefined();
  });

  // The budget is an expectation, not a cap (ROADMAP.md §1).
  it("accepts a bid above the shipper's budget", async () => {
    const offer = await offersService.submitOffer(
      "carrier-1",
      "job-1",
      offerInput({ priceCents: 50_000 })
    );

    expect(offer.priceCents).toBe(50_000);
  });
});

// ========================================
// Withdraw — §4
// ========================================

describe("offersService.withdrawOffer", () => {
  beforeEach(() => {
    Object.assign(offersDal, {
      getById: vi.fn().mockResolvedValue({
        id: "offer-1",
        carrierId: "carrier-1",
        listingId: "job-1",
        status: "pending",
      }),
      updateStatus: vi.fn(async (id, status) => ({ id, status })),
      incrementListingOffersCount: vi.fn(),
    });
  });

  it("withdraws and decrements the job's offer count", async () => {
    const result = await offersService.withdrawOffer("carrier-1", "offer-1");

    expect(result.status).toBe("withdrawn");
    expect(offersDal.incrementListingOffersCount).toHaveBeenCalledWith(
      "job-1",
      -1,
      expect.anything()
    );
  });

  it("refuses to withdraw someone else's offer", async () => {
    expect(await codeFrom(() => offersService.withdrawOffer("intruder", "offer-1")))
      .toBe("FORBIDDEN");
  });

  it("refuses to withdraw an offer that already won", async () => {
    Object.assign(offersDal, {
      getById: vi.fn().mockResolvedValue({
        id: "offer-1",
        carrierId: "carrier-1",
        listingId: "job-1",
        status: "accepted",
      }),
    });

    expect(await codeFrom(() => offersService.withdrawOffer("carrier-1", "offer-1")))
      .toBe("OFFER_NOT_PENDING");
  });
});

// ========================================
// Accept — §5, the money path
// ========================================

describe("offersService.acceptOffer", () => {
  const winning = {
    id: "offer-1",
    listingId: "job-1",
    carrierId: "carrier-1",
    priceCents: 18_000,
    estimatedPickup: soon(25 * HOUR),
    estimatedDelivery: soon(48 * HOUR),
    slots: [],
    status: "pending",
  };

  beforeEach(() => {
    Object.assign(offersDal, {
      getById: vi.fn().mockResolvedValue({ ...winning }),
      getByIdForUpdate: vi.fn().mockResolvedValue({ ...winning }),
      updateSchedule: vi.fn(async (id, schedule) => ({ ...winning, ...schedule })),
      updateStatus: vi.fn(async (id, status) => ({ id, status })),
      setPendingStatusForListing: vi
        .fn()
        .mockResolvedValue([{ id: "offer-2", carrierId: "carrier-2" }]),
    });
    Object.assign(listingsDal, {
      getById: vi.fn().mockResolvedValue(listing()),
      getByIdForUpdate: vi.fn().mockResolvedValue(listing()),
      update: vi.fn(),
      createShipment: vi.fn(async (row) => row),
      getShipmentByOfferId: vi.fn().mockResolvedValue({ id: "ship-existing" }),
    });
    vi.mocked(paymentsService.chargeForShipment).mockResolvedValue({
      payment: { id: "pay-1" },
    } as never);
  });

  it("awards the job, rejects the rivals and creates the shipment", async () => {
    const result = await offersService.acceptOffer("shipper-1", "offer-1");

    expect(offersDal.updateStatus).toHaveBeenCalledWith(
      "offer-1",
      "accepted",
      expect.anything()
    );
    expect(offersDal.setPendingStatusForListing).toHaveBeenCalledWith(
      "job-1",
      "rejected",
      expect.anything(),
      "offer-1"
    );
    expect(listingsDal.update).toHaveBeenCalledWith(
      "job-1",
      { status: "awarded", acceptedOfferId: "offer-1" },
      expect.anything()
    );
    expect(result.shipment).toBeDefined();
    expect(result.shipment!.carrierId).toBe("carrier-1");
    expect(result.shipment!.priceCents).toBe(18_000);
    expect(result.alreadyAccepted).toBe(false);
  });

  it("copies the route onto the shipment so later edits cannot rewrite it", async () => {
    const { shipment } = await offersService.acceptOffer("shipper-1", "offer-1");

    expect(shipment).toBeDefined();
    expect(shipment!.pickupAddress).toBe("1 rue de Rivoli");
    expect(shipment!.dropoffAddress).toBe("2 place Bellecour");
  });

  it("only lets the job's own shipper accept", async () => {
    expect(await codeFrom(() => offersService.acceptOffer("someone-else", "offer-1")))
      .toBe("FORBIDDEN_NOT_SHIPPER");
  });

  // An escalated Expedion job is owned by a system account nobody signs into,
  // so the shipper-only rule above would make it permanently unawardable. An
  // operator awards in the client's place - but only on jobs from that inlet.
  describe("on an escalated Expedion job", () => {
    const expedionListing = () =>
      listing({ shipperId: "expedion-system", origin: "expedion" });

    beforeEach(() => {
      Object.assign(listingsDal, {
        getById: vi.fn().mockResolvedValue(expedionListing()),
        getByIdForUpdate: vi.fn().mockResolvedValue(expedionListing()),
      });
    });

    it("lets an operator award it", async () => {
      vi.mocked(userHasRole).mockImplementation(
        async (_id, role) => role === "operator"
      );

      const { shipment } = await offersService.acceptOffer("op-1", "offer-1");
      expect(shipment).toBeTruthy();
    });

    it("lets an admin award it", async () => {
      vi.mocked(userHasRole).mockImplementation(
        async (_id, role) => role === "admin"
      );

      const { shipment } = await offersService.acceptOffer("admin-1", "offer-1");
      expect(shipment).toBeTruthy();
    });

    it("refuses anyone without an operating role", async () => {
      vi.mocked(userHasRole).mockResolvedValue(false);

      expect(await codeFrom(() => offersService.acceptOffer("driver-9", "offer-1")))
        .toBe("FORBIDDEN_NOT_OPERATOR");
    });

    // The operator clicked; the system account owns the job and therefore the
    // money. Charging the operator would be a real-world billing error.
    it("bills the listing's shipper, not the operator who clicked", async () => {
      vi.mocked(userHasRole).mockResolvedValue(true);

      await offersService.acceptOffer("op-1", "offer-1");

      expect(paymentsService.chargeForShipment).toHaveBeenCalledWith(
        expect.objectContaining({ shipperId: "expedion-system" })
      );
    });

    // The client paid in Expedion when they accepted the quote. Charging here
    // would be a second debit — and could not succeed anyway, since the system
    // account that owns the listing has no card
    // (docs/specs/payment_at_booking_spec.md §2.1).
    it("records the money as taken elsewhere rather than charging again", async () => {
      vi.mocked(userHasRole).mockResolvedValue(true);

      await offersService.acceptOffer("op-1", "offer-1");

      expect(paymentsService.chargeForShipment).toHaveBeenCalledWith(
        expect.objectContaining({ source: "expedion" })
      );
    });
  });

  // A direct listing must not gain an operator escape hatch.
  it("does not let an operator award a direct job", async () => {
    vi.mocked(userHasRole).mockResolvedValue(true);

    expect(await codeFrom(() => offersService.acceptOffer("op-1", "offer-1")))
      .toBe("FORBIDDEN_NOT_SHIPPER");
  });

  it("is idempotent: re-accepting returns the same shipment", async () => {
    Object.assign(offersDal, {
      getById: vi.fn().mockResolvedValue({ ...winning, status: "accepted" }),
    });

    const result = await offersService.acceptOffer("shipper-1", "offer-1");

    expect(result.alreadyAccepted).toBe(true);
    expect(result.shipment).toEqual({ id: "ship-existing" });
    expect(listingsDal.createShipment).not.toHaveBeenCalled();
  });

  // The concurrency guarantee: the second accept sees acceptedOfferId inside
  // the lock and loses.
  it("refuses a second award once the job is taken", async () => {
    Object.assign(listingsDal, {
      getByIdForUpdate: vi
        .fn()
        .mockResolvedValue(listing({ acceptedOfferId: "offer-2" })),
    });

    expect(await codeFrom(() => offersService.acceptOffer("shipper-1", "offer-1")))
      .toBe("LISTING_ALREADY_AWARDED");
  });

  it("refuses to award work to a carrier suspended after bidding", async () => {
    Object.assign(carriersDal, {
      getByUserId: vi.fn().mockResolvedValue({ id: "c", status: "suspended" }),
    });

    expect(await codeFrom(() => offersService.acceptOffer("shipper-1", "offer-1")))
      .toBe("CARRIER_NO_LONGER_APPROVED");
  });

  it("returns the job to the marketplace when payment authorisation fails", async () => {
    vi.mocked(paymentsService.chargeForShipment).mockRejectedValue(
      new Error("card declined")
    );
    const compensate = vi
      .spyOn(offersService, "compensateFailedAward")
      .mockResolvedValue(undefined);

    await expect(
      offersService.acceptOffer("shipper-1", "offer-1")
    ).rejects.toThrow("card declined");

    expect(compensate).toHaveBeenCalledWith("job-1", "offer-1", ["offer-2"]);
    compensate.mockRestore();
  });

  it("charges the winning bid, not the shipper's budget", async () => {
    await offersService.acceptOffer("shipper-1", "offer-1");

    expect(paymentsService.chargeForShipment).toHaveBeenCalledWith(
      expect.objectContaining({ amountCents: 18_000 })
    );
  });

  it("takes the money from the poster, on their own card", async () => {
    await offersService.acceptOffer("shipper-1", "offer-1");

    expect(paymentsService.chargeForShipment).toHaveBeenCalledWith(
      expect.objectContaining({ source: "stripe", shipperId: "shipper-1" })
    );
  });
});

// ========================================
// Visibility — §6
// ========================================

describe("offersService.getOffersForViewer", () => {
  const rows = [
    { id: "o1", carrierId: "carrier-1", priceCents: 15_000, carrier: { rating: 3 } },
    { id: "o2", carrierId: "carrier-2", priceCents: 19_000, carrier: { rating: 5 } },
  ];

  beforeEach(() => {
    Object.assign(listingsDal, { getById: vi.fn().mockResolvedValue(listing()) });
    Object.assign(offersDal, {
      listByListing: vi.fn().mockResolvedValue(rows),
      getLiveByCarrierAndListing: vi.fn().mockResolvedValue(undefined),
      getById: vi.fn().mockResolvedValue(rows[0]),
      getAggregate: vi
        .fn()
        .mockResolvedValue({ offersCount: 2, lowestPriceCents: 15_000 }),
    });
  });

  it("shows the shipper every bid", async () => {
    const result = await offersService.getOffersForViewer("job-1", "shipper-1");

    expect(result.scope).toBe("full");
    expect(result.offers).toHaveLength(2);
  });

  it("shows staff every bid", async () => {
    const result = await offersService.getOffersForViewer("job-1", "operator-9", {
      isStaff: true,
    });

    expect(result.scope).toBe("full");
  });

  it("shows a bidding carrier only its own offer", async () => {
    Object.assign(offersDal, {
      getLiveByCarrierAndListing: vi.fn().mockResolvedValue(rows[0]),
    });

    const result = await offersService.getOffersForViewer("job-1", "carrier-1");

    expect(result.scope).toBe("own");
    expect(result.offers).toHaveLength(1);
  });

  it("shows everyone else aggregates only, never the bids", async () => {
    const result = await offersService.getOffersForViewer("job-1", null);

    expect(result.scope).toBe("aggregate");
    expect(result).not.toHaveProperty("offers");
    expect(result).toMatchObject({ offersCount: 2, lowestPriceCents: 15_000 });
  });

  it("sorts by rating in memory, since it lives on the joined carrier", async () => {
    const result = await offersService.getOffersForViewer("job-1", "shipper-1", {
      sort: "rating_desc",
    });

    expect(result.offers?.map((o) => o.id)).toEqual(["o2", "o1"]);
  });
});

// ========================================
// Take it now — transport self-accept
// ========================================

describe("offersService.takeJob", () => {
  beforeEach(() => {
    Object.assign(offersDal, {
      ...offersDal,
      markSelfAccepted: vi.fn(async (id) => ({ id, selfAccepted: true })),
      getById: vi.fn().mockResolvedValue({
        id: "offer-1",
        listingId: "job-1",
        carrierId: "carrier-1",
        status: "pending",
        priceCents: 20_000,
      }),
      getByIdForUpdate: vi.fn().mockResolvedValue({
        id: "offer-1",
        listingId: "job-1",
        carrierId: "carrier-1",
        status: "pending",
        priceCents: 20_000,
      }),
      updateStatus: vi.fn(async (id, status) => ({ id, status })),
      setPendingStatusForListing: vi.fn().mockResolvedValue([]),
    });
    Object.assign(listingsDal, {
      ...listingsDal,
      getByIdForUpdate: vi.fn().mockResolvedValue(listing()),
      createShipment: vi.fn(async (row) => row),
      update: vi.fn(async (id, data) => ({ id, ...data })),
      getShipmentByOfferId: vi.fn().mockResolvedValue(null),
    });
    vi.mocked(paymentsService.chargeForShipment).mockResolvedValue({
      payment: { id: "pay-1", status: "authorised" },
    } as never);
  });

  it("takes the job at the posted budget, not at a price the caller names", async () => {
    // The whole difference between this and a bid is that there is no
    // negotiation, so the amount must come off the listing.
    await offersService.takeJob("carrier-1", "job-1", { vehicleId: "veh-1" });

    const created = vi.mocked(offersDal.create).mock.calls[0][0];
    expect(created.priceCents).toBe(20_000);
  });

  it("marks the offer as self-accepted so an operator can tell it apart", async () => {
    await offersService.takeJob("carrier-1", "job-1", { vehicleId: "veh-1" });

    // The id is minted inside submitOffer, so the assertion follows the row
    // that was actually created rather than a fixture id.
    const created = vi.mocked(offersDal.create).mock.calls[0][0];
    expect(offersDal.markSelfAccepted).toHaveBeenCalledWith(created.id);
  });

  it("refuses a job that is no longer open, which is the two-drivers race", async () => {
    vi.mocked(listingsDal).getById = vi
      .fn()
      .mockResolvedValue(listing({ status: "awarded" }));

    const code = await codeFrom(() =>
      offersService.takeJob("carrier-1", "job-1", { vehicleId: "veh-1" })
    );

    expect(code).toBe("LISTING_NOT_OPEN");
  });

  it("refuses a carrier who is not approved", async () => {
    vi.mocked(carriersDal).getByUserId = vi
      .fn()
      .mockResolvedValue({ id: "carrier-co-1", status: "submitted" });

    const code = await codeFrom(() =>
      offersService.takeJob("carrier-1", "job-1", { vehicleId: "veh-1" })
    );

    expect(code).toBe("CARRIER_NOT_APPROVED");
  });
});

// ========================================
// Self-award is opt-in, never ambient
// ========================================

describe("offersService.acceptOffer self-award gate", () => {
  it("refuses a carrier accepting their own offer without the flag", async () => {
    // The permission rule is shared with the operator award queue, so widening
    // it in place would let anyone with an offer award themselves from there.
    Object.assign(offersDal, {
      ...offersDal,
      getById: vi.fn().mockResolvedValue({
        id: "offer-1",
        listingId: "job-1",
        carrierId: "carrier-1",
        status: "pending",
      }),
    });
    vi.mocked(listingsDal).getById = vi.fn().mockResolvedValue(listing());
    vi.mocked(userHasRole).mockResolvedValue(false);

    const code = await codeFrom(() =>
      offersService.acceptOffer("carrier-1", "offer-1")
    );

    expect(code).toBe("FORBIDDEN_NOT_SHIPPER");
  });

  it("refuses the flag when the offer belongs to somebody else", async () => {
    Object.assign(offersDal, {
      ...offersDal,
      getById: vi.fn().mockResolvedValue({
        id: "offer-1",
        listingId: "job-1",
        carrierId: "someone-else",
        status: "pending",
      }),
    });
    vi.mocked(listingsDal).getById = vi.fn().mockResolvedValue(listing());
    vi.mocked(userHasRole).mockResolvedValue(false);

    const code = await codeFrom(() =>
      offersService.acceptOffer("carrier-1", "offer-1", { selfAward: true })
    );

    expect(code).toBe("FORBIDDEN_NOT_SHIPPER");
  });
});

// ========================================
// Time slots — docs/specs/offer_time_slots_spec.md
// ========================================

describe("proposed time slots", () => {
  const flexible = () => {
    Object.assign(listingsDal, {
      getById: vi.fn().mockResolvedValue(listing({ isFlexible: true })),
    });
  };

  it("stores the earliest slot as the offer's schedule", async () => {
    flexible();

    const offer = await offersService.submitOffer(
      "carrier-1",
      "job-1",
      offerInput({
        // Deliberately out of order: the row must carry the earliest, because
        // `pickup_asc` sorts the board and the award queue by this column.
        slots: [
          { day: "2026-09-02", slot: "morning" },
          { day: "2026-08-25", slot: "evening" },
        ],
        deliveryLeadDays: 1,
        tzOffset: 0,
      })
    );

    expect(offer.estimatedPickup.toISOString()).toBe("2026-08-25T18:00:00.000Z");
    expect(offer.estimatedDelivery.toISOString()).toBe("2026-08-26T22:00:00.000Z");
    expect(offer.deliveryLeadDays).toBe(1);
  });

  it("writes one row per proposed slot, earliest first", async () => {
    flexible();

    await offersService.submitOffer(
      "carrier-1",
      "job-1",
      offerInput({
        slots: [
          { day: "2026-09-02", slot: "morning" },
          { day: "2026-08-25", slot: "evening" },
        ],
        tzOffset: 0,
      })
    );

    const [rows] = vi.mocked(offersDal.createSlots).mock.calls[0];
    expect(rows.map((row) => `${row.day} ${row.slot}`)).toEqual([
      "2026-08-25 evening",
      "2026-09-02 morning",
    ]);
    expect(rows.every((row) => row.offerId)).toBe(true);
  });

  // Taking a job as posted is not a proposal, so there is nothing to book and
  // the job keeps its own window (spec §3.4).
  it("writes no slot rows when nothing is proposed", async () => {
    const offer = await offersService.submitOffer("carrier-1", "job-1", {
      vehicleId: "veh-1",
      priceCents: 18_000,
      slots: [],
      deliveryLeadDays: 0,
      tzOffset: 0,
    });

    expect(offersDal.createSlots).toHaveBeenCalledWith([], expect.anything());

    const job = await vi.mocked(listingsDal.getById).mock.results[0].value;
    // Named explicitly rather than read off the fixture: the fixture carried no
    // dropoffFrom until this assertion needed one, so the comparison was
    // undefined against undefined and passed on nothing.
    expect(job.dropoffFrom).toBeInstanceOf(Date);
    expect(offer.estimatedPickup).toEqual(job.pickupFrom);
    expect(offer.estimatedDelivery).toEqual(job.dropoffFrom);
  });
});

describe("booking a slot on award", () => {
  const slotA = {
    id: "slot-a",
    startsAt: new Date("2026-08-25T04:00:00Z"),
    endsAt: new Date("2026-08-25T10:00:00Z"),
    deliveryAt: new Date("2026-08-25T20:00:00Z"),
  };
  const slotB = {
    id: "slot-b",
    startsAt: new Date("2026-08-27T10:00:00Z"),
    endsAt: new Date("2026-08-27T16:00:00Z"),
    deliveryAt: new Date("2026-08-27T20:00:00Z"),
  };

  const proposing = {
    id: "offer-1",
    listingId: "job-1",
    carrierId: "carrier-1",
    priceCents: 18_000,
    estimatedPickup: slotA.startsAt,
    estimatedDelivery: slotA.deliveryAt,
    slots: [slotA, slotB],
    status: "pending",
  };

  beforeEach(() => {
    Object.assign(offersDal, {
      getById: vi.fn().mockResolvedValue({ ...proposing }),
      getByIdForUpdate: vi.fn().mockResolvedValue({ ...proposing }),
      updateSchedule: vi.fn(async (id, schedule) => ({ ...proposing, ...schedule })),
      updateStatus: vi.fn(async (id, status) => ({ id, status })),
      setPendingStatusForListing: vi.fn().mockResolvedValue([]),
    });
    Object.assign(listingsDal, {
      getById: vi.fn().mockResolvedValue(listing()),
      getByIdForUpdate: vi.fn().mockResolvedValue(listing()),
      update: vi.fn(),
      createShipment: vi.fn(async (row) => row),
      getShipmentByOfferId: vi.fn().mockResolvedValue({ id: "ship-existing" }),
    });
    vi.mocked(paymentsService.chargeForShipment).mockResolvedValue({
      payment: { id: "pay-1" },
    } as never);
  });

  it("schedules the shipment from the slot the acceptor named", async () => {
    const { shipment } = await offersService.acceptOffer("shipper-1", "offer-1", {
      slotId: "slot-b",
    });

    expect(shipment!.scheduledPickup).toEqual(slotB.startsAt);
    expect(shipment!.scheduledDelivery).toEqual(slotB.deliveryAt);
  });

  // Writing it back onto the offer is what makes the booked slot the answer
  // for the offer card, the carrier's list and the Expedion write-back too.
  it("rewrites the offer's own schedule to the booked slot", async () => {
    await offersService.acceptOffer("shipper-1", "offer-1", { slotId: "slot-b" });

    expect(offersDal.updateSchedule).toHaveBeenCalledWith(
      "offer-1",
      { estimatedPickup: slotB.startsAt, estimatedDelivery: slotB.deliveryAt },
      expect.anything()
    );
  });

  it("takes the earliest slot when none is named, touching nothing", async () => {
    const { shipment } = await offersService.acceptOffer("shipper-1", "offer-1");

    expect(offersDal.updateSchedule).not.toHaveBeenCalled();
    expect(shipment!.scheduledPickup).toEqual(slotA.startsAt);
  });

  it("refuses a slot belonging to another offer", async () => {
    expect(
      await codeFrom(() =>
        offersService.acceptOffer("shipper-1", "offer-1", { slotId: "slot-z" })
      )
    ).toBe("SLOT_NOT_ON_OFFER");
  });
});

// ========================================
// Revoking an award — the money goes back before the job does
// ========================================
//
// The client pays at booking (docs/specs/payment_at_booking_spec.md), so an
// un-award has real money to undo. Before that change this released a hold;
// now it refunds a charge, and getting it wrong means the job returns to the
// board with the client's money still spent on a driver who is not doing it.

describe("offersService.revokeAward", () => {
  beforeEach(() => {
    vi.mocked(userHasRole).mockResolvedValue(true);
    Object.assign(offersDal, {
      getById: vi
        .fn()
        .mockResolvedValue({ id: "offer-1", carrierId: "carrier-1" }),
      listByListing: vi.fn().mockResolvedValue([]),
      updateStatus: vi.fn(async (id, status) => ({ id, status })),
    });
    Object.assign(listingsDal, {
      getById: vi
        .fn()
        .mockResolvedValue(
          listing({ status: "awarded", acceptedOfferId: "offer-1" })
        ),
      update: vi.fn(),
      getShipmentByOfferId: vi
        .fn()
        .mockResolvedValue({ id: "ship-1", status: "PENDING" }),
    });
    vi.mocked(paymentsService.refundForShipment).mockResolvedValue({} as never);
  });

  it("refunds the client before putting the job back on the board", async () => {
    await offersService.revokeAward("op-1", "job-1");

    expect(paymentsService.refundForShipment).toHaveBeenCalledWith("ship-1");
    expect(listingsDal.update).toHaveBeenCalledWith(
      "job-1",
      { status: "open", acceptedOfferId: null },
      expect.anything()
    );
  });

  it("still un-awards when the refund is not ours to make", async () => {
    // An Expedion job's money was taken in that app, so `refundForShipment`
    // throws REFUND_NOT_LOCAL. The operator's un-award must still stand.
    vi.mocked(paymentsService.refundForShipment).mockRejectedValue(
      new Error("REFUND_NOT_LOCAL")
    );

    await offersService.revokeAward("op-1", "job-1");

    expect(listingsDal.update).toHaveBeenCalledWith(
      "job-1",
      { status: "open", acceptedOfferId: null },
      expect.anything()
    );
  });

  it("refuses once the goods have been collected, and refunds nothing", async () => {
    vi.mocked(listingsDal.getShipmentByOfferId).mockResolvedValue({
      id: "ship-1",
      status: "IN_TRANSIT",
    } as never);

    expect(
      await codeFrom(() => offersService.revokeAward("op-1", "job-1"))
    ).toBe("SHIPMENT_ALREADY_STARTED");
    expect(paymentsService.refundForShipment).not.toHaveBeenCalled();
  });

  it("is an operator action, not something a shipper can do", async () => {
    vi.mocked(userHasRole).mockResolvedValue(false);

    expect(
      await codeFrom(() => offersService.revokeAward("shipper-1", "job-1"))
    ).toBe("FORBIDDEN_NOT_OPERATOR");
  });
});
