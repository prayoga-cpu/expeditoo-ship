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
vi.mock("@/server/services/notifications.service", () => ({
  notificationsService: { createNotification: vi.fn().mockResolvedValue({}) },
}));
vi.mock("@/server/services/payments.service", () => ({
  paymentsService: { authoriseForShipment: vi.fn() },
}));
vi.mock("@/server/services/expedion-bridge.service", () => ({
  expedionBridgeService: { onOfferAccepted: vi.fn() },
  notifyExpedion: vi.fn(),
}));

import { offersService, OfferError } from "../offers.service";
import { offersDal } from "@/server/dal/offers.dal";
import { listingsDal } from "@/server/dal/listings.dal";
import { carriersDal } from "@/server/dal/carriers.dal";
import { paymentsService } from "@/server/services/payments.service";

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

const offerInput = (over: Record<string, unknown> = {}) => ({
  vehicleId: "veh-1",
  priceCents: 18_000,
  estimatedPickup: soon(25 * HOUR),
  estimatedDelivery: soon(48 * HOUR),
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

  it("rejects a pickup outside the shipper's window", async () => {
    expect(
      await codeFrom(() =>
        offersService.submitOffer(
          "carrier-1",
          "job-1",
          offerInput({ estimatedPickup: soon(80 * HOUR) })
        )
      )
    ).toBe("PICKUP_OUTSIDE_WINDOW");
  });

  it("permits a pickup outside the window when the job is flexible", async () => {
    Object.assign(listingsDal, {
      getById: vi.fn().mockResolvedValue(listing({ isFlexible: true })),
    });

    await expect(
      offersService.submitOffer(
        "carrier-1",
        "job-1",
        offerInput({ estimatedPickup: soon(80 * HOUR) })
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
    status: "pending",
  };

  beforeEach(() => {
    Object.assign(offersDal, {
      getById: vi.fn().mockResolvedValue({ ...winning }),
      getByIdForUpdate: vi.fn().mockResolvedValue({ ...winning }),
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
    vi.mocked(paymentsService.authoriseForShipment).mockResolvedValue({
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
    vi.mocked(paymentsService.authoriseForShipment).mockRejectedValue(
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

  it("authorises the winning bid, not the shipper's budget", async () => {
    await offersService.acceptOffer("shipper-1", "offer-1");

    expect(paymentsService.authoriseForShipment).toHaveBeenCalledWith(
      expect.objectContaining({ amountCents: 18_000 })
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
