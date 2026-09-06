import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/server/dal/listings.dal", () => ({ listingsDal: {} }));
vi.mock("@/server/dal/shipments.dal", () => ({ shipmentsDal: {} }));
vi.mock("@/server/services/offers.service", () => ({
  offersService: { expirePendingOffers: vi.fn().mockResolvedValue([]) },
}));
vi.mock("@/server/services/notifications.service", () => ({
  notificationsService: { createNotification: vi.fn().mockResolvedValue({}) },
}));
// A job only reaches the board once its poster can be charged
// (docs/specs/payment_at_booking_spec.md §4). Defaulted to "has a card" so the
// cases below stay about publishing; the ones that care override it.
vi.mock("@/server/services/payments.service", () => ({
  paymentsService: { hasSavedCard: vi.fn() },
}));

import {
  listingsService,
  resolveExpiresAt,
  ListingError,
} from "../listings.service";
import { listingsDal } from "@/server/dal/listings.dal";
import { shipmentsDal } from "@/server/dal/shipments.dal";
import { offersService } from "@/server/services/offers.service";
import { paymentsService } from "@/server/services/payments.service";

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;
const at = (ms: number) => new Date(Date.now() + ms);

const job = (over: Record<string, unknown> = {}) => ({
  id: "job-1",
  shipperId: "shipper-1",
  status: "open",
  title: "Pallet to Marseille",
  offersCount: 0,
  pickupFrom: at(48 * HOUR),
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(listingsDal, {
    getById: vi.fn().mockResolvedValue(job()),
    create: vi.fn(async (row) => row),
    update: vi.fn(async (id, data) => ({ id, ...data })),
    delete: vi.fn(),
    addPhotos: vi.fn(),
    findExpired: vi.fn().mockResolvedValue([]),
    browse: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    getByShipperId: vi.fn().mockResolvedValue([]),
    incrementViews: vi.fn(),
    ensureDefaultCategory: vi.fn().mockResolvedValue("transport-general"),
  });
  Object.assign(shipmentsDal, {
    listDeliveredForListings: vi.fn().mockResolvedValue([]),
  });
  vi.mocked(offersService.expirePendingOffers).mockResolvedValue([]);
  vi.mocked(paymentsService.hasSavedCard).mockResolvedValue(true);
});

async function codeFrom(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof ListingError) return error.code;
    throw error;
  }
  throw new Error("expected the call to throw");
}

// ========================================
// Bidding window — transport_listing_spec.md §2, edge case 2
// ========================================

describe("resolveExpiresAt", () => {
  it("closes bidding 6 hours before pickup when there is room", () => {
    const pickup = at(48 * HOUR);
    const expires = resolveExpiresAt(pickup);

    expect(expires.getTime()).toBe(pickup.getTime() - 6 * HOUR);
  });

  // A job posted at short notice still needs a window carriers can bid into.
  it("clamps to a 30-minute window for a job posted inside the 6-hour lead", () => {
    const now = new Date();
    const pickup = new Date(now.getTime() + 2 * HOUR);
    const expires = resolveExpiresAt(pickup, now);

    expect(expires.getTime()).toBe(now.getTime() + 30 * MINUTE);
    expect(expires.getTime()).toBeLessThan(pickup.getTime());
  });

  it("refuses a pickup so soon that nobody could bid", async () => {
    const now = new Date();
    const pickup = new Date(now.getTime() + 10 * MINUTE);

    expect(() => resolveExpiresAt(pickup, now)).toThrow();
    expect(await codeFrom(async () => resolveExpiresAt(pickup, now))).toBe(
      "PICKUP_TOO_SOON"
    );
  });
});

// ========================================
// Publishing — §1, §3
// ========================================

describe("listingsService.publishListing", () => {
  it("moves a draft to open and recomputes the window", async () => {
    Object.assign(listingsDal, {
      getById: vi.fn().mockResolvedValue(job({ status: "draft" })),
    });

    const result = await listingsService.publishListing("shipper-1", "job-1");

    expect(result.status).toBe("open");
    expect(result.expiresAt).toBeInstanceOf(Date);
  });

  it("refuses to publish a job that is already live", async () => {
    expect(
      await codeFrom(() => listingsService.publishListing("shipper-1", "job-1"))
    ).toBe("LISTING_NOT_DRAFT");
  });

  it("refuses to publish once the pickup date has passed", async () => {
    Object.assign(listingsDal, {
      getById: vi
        .fn()
        .mockResolvedValue(job({ status: "draft", pickupFrom: at(-HOUR) })),
    });

    expect(
      await codeFrom(() => listingsService.publishListing("shipper-1", "job-1"))
    ).toBe("PICKUP_IN_PAST");
  });

  it("lets only the owner publish", async () => {
    Object.assign(listingsDal, {
      getById: vi.fn().mockResolvedValue(job({ status: "draft" })),
    });

    expect(
      await codeFrom(() => listingsService.publishListing("intruder", "job-1"))
    ).toBe("FORBIDDEN_NOT_OWNER");
  });
});

// ========================================
// Editing — §4, the material/non-material split
// ========================================

describe("listingsService.updateListing", () => {
  it("leaves offers alone when only the description changes", async () => {
    Object.assign(listingsDal, {
      getById: vi.fn().mockResolvedValue(job({ offersCount: 3 })),
    });

    const result = await listingsService.updateListing("shipper-1", "job-1", {
      description: "Clarified access details",
    });

    expect(offersService.expirePendingOffers).not.toHaveBeenCalled();
    expect(result.invalidatedOffers).toBe(0);
  });

  it("leaves offers alone when only the budget changes", async () => {
    Object.assign(listingsDal, {
      getById: vi.fn().mockResolvedValue(job({ offersCount: 2 })),
    });

    await listingsService.updateListing("shipper-1", "job-1", {
      budgetCents: 30_000,
    });

    expect(offersService.expirePendingOffers).not.toHaveBeenCalled();
  });

  // Changing what a carrier priced against invalidates their quote.
  it("expires every live offer when the weight changes", async () => {
    Object.assign(listingsDal, {
      getById: vi.fn().mockResolvedValue(job({ offersCount: 2 })),
    });
    vi.mocked(offersService.expirePendingOffers).mockResolvedValue([
      { carrierId: "c1" },
      { carrierId: "c2" },
    ] as never);

    const result = await listingsService.updateListing("shipper-1", "job-1", {
      weightKg: 500,
    });

    expect(offersService.expirePendingOffers).toHaveBeenCalledWith("job-1");
    expect(result.invalidatedOffers).toBe(2);
  });

  it("expires offers when the pickup window moves", async () => {
    Object.assign(listingsDal, {
      getById: vi.fn().mockResolvedValue(job({ offersCount: 1 })),
    });
    vi.mocked(offersService.expirePendingOffers).mockResolvedValue([
      { carrierId: "c1" },
    ] as never);

    const result = await listingsService.updateListing("shipper-1", "job-1", {
      pickupFrom: at(72 * HOUR),
    });

    expect(result.invalidatedOffers).toBe(1);
  });

  it("does not run the expiry when a material field changes but nobody has bid", async () => {
    await listingsService.updateListing("shipper-1", "job-1", { weightKg: 500 });

    expect(offersService.expirePendingOffers).not.toHaveBeenCalled();
  });

  it("refuses to edit an awarded job", async () => {
    Object.assign(listingsDal, {
      getById: vi.fn().mockResolvedValue(job({ status: "awarded" })),
    });

    expect(
      await codeFrom(() =>
        listingsService.updateListing("shipper-1", "job-1", { title: "New" })
      )
    ).toBe("LISTING_NOT_EDITABLE");
  });
});

// ========================================
// Cancellation — §5
// ========================================

describe("listingsService.cancelListing", () => {
  it("hard-deletes a draft", async () => {
    Object.assign(listingsDal, {
      getById: vi.fn().mockResolvedValue(job({ status: "draft" })),
    });

    const result = await listingsService.cancelListing("shipper-1", "job-1");

    expect(result.deleted).toBe(true);
    expect(listingsDal.delete).toHaveBeenCalledWith("job-1");
  });

  it("cancels a live job and settles its offers", async () => {
    const result = await listingsService.cancelListing("shipper-1", "job-1");

    expect(result.deleted).toBe(false);
    expect(offersService.expirePendingOffers).toHaveBeenCalledWith("job-1");
    expect(listingsDal.update).toHaveBeenCalledWith("job-1", {
      status: "cancelled",
      offersCount: 0,
    });
  });

  // This door is for a job nobody has taken yet, and only that. Once an offer
  // has been accepted there is a shipment, a driver planning around it and the
  // client's money — ending it here would leave the listing `cancelled` with
  // `accepted_offer_id` still set, the run still on the driver's screen and
  // nothing refunded, bypassing every guarantee the cancellation service makes.
  it("refuses an awarded job and names the door that works", async () => {
    Object.assign(listingsDal, {
      getById: vi.fn().mockResolvedValue(job({ status: "awarded" })),
    });

    expect(
      await codeFrom(() => listingsService.cancelListing("shipper-1", "job-1"))
    ).toBe("CANCEL_VIA_SHIPMENT");
    expect(listingsDal.update).not.toHaveBeenCalled();
  });

  it("refuses an awarded job to an admin too", async () => {
    // The admin listings table calls the same route. Being staff is not a
    // reason to end a live run without refunding it.
    Object.assign(listingsDal, {
      getById: vi.fn().mockResolvedValue(job({ status: "awarded" })),
    });

    expect(
      await codeFrom(() =>
        listingsService.cancelListing("admin-1", "job-1", true)
      )
    ).toBe("CANCEL_VIA_SHIPMENT");
  });

  it("refuses an in-progress job on the same grounds", async () => {
    Object.assign(listingsDal, {
      getById: vi.fn().mockResolvedValue(job({ status: "in_progress" })),
    });

    expect(
      await codeFrom(() => listingsService.cancelListing("shipper-1", "job-1"))
    ).toBe("CANCEL_VIA_SHIPMENT");
  });

  it("refuses to cancel a completed job", async () => {
    Object.assign(listingsDal, {
      getById: vi.fn().mockResolvedValue(job({ status: "completed" })),
    });

    expect(
      await codeFrom(() => listingsService.cancelListing("shipper-1", "job-1"))
    ).toBe("LISTING_NOT_CANCELLABLE");
  });

  it("stops a stranger cancelling someone else's job", async () => {
    expect(
      await codeFrom(() => listingsService.cancelListing("intruder", "job-1"))
    ).toBe("FORBIDDEN_NOT_OWNER");
  });
});

// ========================================
// Reading — §3, edge cases
// ========================================

describe("listingsService.getListing", () => {
  it("hides a draft from everyone but its author", async () => {
    Object.assign(listingsDal, {
      getById: vi.fn().mockResolvedValue(job({ status: "draft" })),
    });

    // Reported as not-found rather than forbidden, so an unpublished job does
    // not leak its own existence.
    expect(
      await codeFrom(() => listingsService.getListing("job-1", "someone-else"))
    ).toBe("LISTING_NOT_FOUND");
  });

  it("shows the author their own draft", async () => {
    Object.assign(listingsDal, {
      getById: vi.fn().mockResolvedValue(job({ status: "draft" })),
    });

    await expect(
      listingsService.getListing("job-1", "shipper-1")
    ).resolves.toBeDefined();
  });

  it("does not count the owner's own visit as a view", async () => {
    await listingsService.getListing("job-1", "shipper-1");

    expect(listingsDal.incrementViews).not.toHaveBeenCalled();
  });

  it("counts a visit from anyone else", async () => {
    await listingsService.getListing("job-1", "visitor-9");

    expect(listingsDal.incrementViews).toHaveBeenCalledWith("job-1");
  });
});

// ========================================
// Expiry — offers_engine_spec.md §7
// ========================================

describe("listingsService.expireDueListings", () => {
  it("expires each due job, settles its offers and tells the shipper", async () => {
    Object.assign(listingsDal, {
      findExpired: vi
        .fn()
        .mockResolvedValue([job({ id: "a" }), job({ id: "b" })]),
    });

    const count = await listingsService.expireDueListings();

    expect(count).toBe(2);
    expect(offersService.expirePendingOffers).toHaveBeenCalledTimes(2);
    expect(listingsDal.update).toHaveBeenCalledWith("a", { status: "expired" });
    expect(listingsDal.update).toHaveBeenCalledWith("b", { status: "expired" });
  });

  it("does nothing when no job is due", async () => {
    const count = await listingsService.expireDueListings();

    expect(count).toBe(0);
    expect(listingsDal.update).not.toHaveBeenCalled();
  });
});

// ========================================
// Creating a request — transport_request_spec.md §4 and §5
// ========================================

/** A minimally valid create payload; the DTO has already validated by here. */
const createInput = (over: Record<string, unknown> = {}) =>
  ({
    title: "Two-seater sofa to Marseille",
    description: "A sofa and a coffee table, ground floor both ends.",
    weightKg: 80,
    quantity: 1,
    isFragile: false,
    needsHelp: false,
    pickup: { lat: 45.75, lng: 4.85, address: "12 rue A", city: "Lyon" },
    dropoff: { lat: 43.3, lng: 5.37, address: "3 rue B", city: "Marseille" },
    pickupFrom: at(48 * HOUR),
    pickupUntil: at(56 * HOUR),
    dropoffFrom: at(72 * HOUR),
    dropoffUntil: at(80 * HOUR),
    isFlexible: false,
    budgetCents: 25_000,
    photos: [],
    publish: true,
    ...over,
  }) as never;

describe("createListing", () => {
  it("stamps origin as direct, whatever the caller passed", async () => {
    // origin is not on the DTO, but a caller could still smuggle the key in.
    // acceptOffer reads listing.origin to decide whether an operator may award
    // in the owner's place, so a client-chosen origin is a privilege escalation.
    await listingsService.createListing(
      "user-1",
      createInput({ origin: "expedion" })
    );

    const row = vi.mocked(listingsDal.create).mock.calls[0][0];
    expect(row.origin).toBe("direct");
  });

  it("resolves a category when the caller names none", async () => {
    await listingsService.createListing("user-1", createInput());

    expect(listingsDal.ensureDefaultCategory).toHaveBeenCalled();
    const row = vi.mocked(listingsDal.create).mock.calls[0][0];
    expect(row.categoryId).toBe("transport-general");
  });

  it("honours an explicit category and does not resolve one", async () => {
    await listingsService.createListing(
      "user-1",
      createInput({ categoryId: "encheres" })
    );

    expect(listingsDal.ensureDefaultCategory).not.toHaveBeenCalled();
    const row = vi.mocked(listingsDal.create).mock.calls[0][0];
    expect(row.categoryId).toBe("encheres");
  });

  it("refuses to publish a job whose pickup has already passed", async () => {
    const code = await codeFrom(() =>
      listingsService.createListing(
        "user-1",
        createInput({ pickupFrom: at(-HOUR) })
      )
    );

    expect(code).toBe("PICKUP_IN_PAST");
  });

  // Pinning existing behaviour rather than endorsing it. `createListing` says
  // the pickup window "is only enforced when the job actually goes live", and
  // its own PICKUP_IN_PAST check is indeed gated on `publish` — but
  // `resolveExpiresAt` runs unconditionally straight afterwards and rejects the
  // same date under a different code. So a draft with a past pickup is refused
  // too, just not by the check that was written to refuse it.
  it("also refuses a draft with a past pickup, via the expiry calculation", async () => {
    const code = await codeFrom(() =>
      listingsService.createListing(
        "user-1",
        createInput({ pickupFrom: at(-HOUR), publish: false })
      )
    );

    expect(code).toBe("PICKUP_TOO_SOON");
  });
});

// ========================================
// Delivery history — my_requests_history_spec.md §10
// ========================================

/** One row as `shipmentsDal.listDeliveredForListings` returns it. */
const delivered = (over: Record<string, unknown> = {}) => ({
  listingId: "job-1",
  shipmentId: "ship-1",
  deliveredAt: new Date("2026-08-20T09:00:00Z"),
  priceCents: 12_000,
  hasDeliveryPhoto: true,
  carrierId: "carrier-1",
  carrierName: "Jean Dupont",
  carrierImage: null,
  carrierRating: 4.5,
  ...over,
});

describe("getMyListings", () => {
  it("attaches the delivery, and the transporter, to a delivered job", async () => {
    vi.mocked(listingsDal.getByShipperId).mockResolvedValue([
      job({ status: "completed" }),
    ] as never);
    vi.mocked(shipmentsDal.listDeliveredForListings).mockResolvedValue([
      delivered(),
    ] as never);

    const [row] = await listingsService.getMyListings("shipper-1");

    expect(row.delivery).toEqual({
      shipmentId: "ship-1",
      deliveredAt: new Date("2026-08-20T09:00:00Z"),
      priceCents: 12_000,
      hasProofOfDelivery: true,
      carrier: {
        id: "carrier-1",
        name: "Jean Dupont",
        image: null,
        rating: 4.5,
      },
    });
  });

  it("leaves delivery null when nothing was delivered", async () => {
    vi.mocked(listingsDal.getByShipperId).mockResolvedValue([job()] as never);

    const [row] = await listingsService.getMyListings("shipper-1");

    expect(row.delivery).toBeNull();
  });

  // The shipment is the fact; `listings.status = 'completed'` is a second,
  // non-transactional write that can lag behind it (spec §3).
  it("reads the shipment, so a delivered job whose listing still says in_progress counts", async () => {
    vi.mocked(listingsDal.getByShipperId).mockResolvedValue([
      job({ status: "in_progress" }),
    ] as never);
    vi.mocked(shipmentsDal.listDeliveredForListings).mockResolvedValue([
      delivered(),
    ] as never);

    const [row] = await listingsService.getMyListings("shipper-1");

    expect(row.status).toBe("in_progress");
    expect(row.delivery?.shipmentId).toBe("ship-1");
  });

  it("never asks for deliveries when the requester has no jobs", async () => {
    vi.mocked(listingsDal.getByShipperId).mockResolvedValue([] as never);

    await expect(listingsService.getMyListings("shipper-1")).resolves.toEqual(
      []
    );
    expect(shipmentsDal.listDeliveredForListings).not.toHaveBeenCalled();
  });

  it("keeps a delivery whose carrier no longer resolves, unnamed", async () => {
    vi.mocked(listingsDal.getByShipperId).mockResolvedValue([job()] as never);
    vi.mocked(shipmentsDal.listDeliveredForListings).mockResolvedValue([
      delivered({
        carrierId: null,
        carrierName: null,
        carrierImage: null,
        carrierRating: null,
      }),
    ] as never);

    const [row] = await listingsService.getMyListings("shipper-1");

    expect(row.delivery?.shipmentId).toBe("ship-1");
    expect(row.delivery?.carrier).toBeNull();
  });

  // The photos live in a private bucket and are read one at a time through an
  // authorising route, so the history payload carries the marker and not the
  // evidence.
  it("reports the delivery photos as a flag, carrying no object key", async () => {
    vi.mocked(listingsDal.getByShipperId).mockResolvedValue([job()] as never);
    vi.mocked(shipmentsDal.listDeliveredForListings).mockResolvedValue([
      delivered({ hasDeliveryPhoto: false }),
    ] as never);

    const [row] = await listingsService.getMyListings("shipper-1");

    expect(row.delivery?.hasProofOfDelivery).toBe(false);
    expect(JSON.stringify(row.delivery)).not.toContain("objectKey");
  });

  // `shipment_listing_idx` is not unique, so a revoked award redelivered later
  // would leave two DELIVERED rows on one listing. The DAL orders them newest
  // first; the history must show that one, not the one it superseded.
  it("shows the most recent delivery when a listing carries two", async () => {
    vi.mocked(listingsDal.getByShipperId).mockResolvedValue([job()] as never);
    vi.mocked(shipmentsDal.listDeliveredForListings).mockResolvedValue([
      delivered({
        shipmentId: "ship-new",
        deliveredAt: new Date("2026-08-25T09:00:00Z"),
      }),
      delivered({
        shipmentId: "ship-old",
        deliveredAt: new Date("2026-08-20T09:00:00Z"),
      }),
    ] as never);

    const [row] = await listingsService.getMyListings("shipper-1");

    expect(row.delivery?.shipmentId).toBe("ship-new");
  });

  it("passes the status filter straight through to the DAL", async () => {
    vi.mocked(listingsDal.getByShipperId).mockResolvedValue([] as never);

    await listingsService.getMyListings("shipper-1", "completed");

    expect(listingsDal.getByShipperId).toHaveBeenCalledWith(
      "shipper-1",
      "completed"
    );
  });
});

// ========================================
// A job may not reach the board unless it can be paid for
// ========================================
//
// docs/specs/payment_at_booking_spec.md §4. The client is charged the moment a
// carrier is chosen, so a job posted without a card is a job that cannot be
// awarded — and every carrier who bids on it has spent effort on work that was
// never payable.

describe("the card a posted job will be charged to", () => {
  beforeEach(() => {
    delete process.env.MOCK_PAYMENTS;
    Object.assign(listingsDal, {
      getById: vi.fn().mockResolvedValue(job({ status: "draft" })),
    });
  });

  it("stops a draft going live without one", async () => {
    vi.mocked(paymentsService.hasSavedCard).mockResolvedValue(false);

    expect(
      await codeFrom(() => listingsService.publishListing("shipper-1", "job-1"))
    ).toBe("PAYMENT_METHOD_REQUIRED");
    expect(listingsDal.update).not.toHaveBeenCalled();
  });

  it("stops a job being posted straight to the board without one", async () => {
    vi.mocked(paymentsService.hasSavedCard).mockResolvedValue(false);

    expect(
      await codeFrom(() =>
        listingsService.createListing("user-1", createInput({ publish: true }))
      )
    ).toBe("PAYMENT_METHOD_REQUIRED");
    expect(listingsDal.create).not.toHaveBeenCalled();
  });

  it("lets a draft be saved without one", async () => {
    // A draft is not on the board and nobody can bid on it, so asking for a
    // card to save one would be a toll on a form that committed to nothing.
    vi.mocked(paymentsService.hasSavedCard).mockResolvedValue(false);

    await listingsService.createListing(
      "user-1",
      createInput({ publish: false })
    );

    expect(listingsDal.create).toHaveBeenCalled();
  });

  it("waives the check for a job that was paid somewhere else", async () => {
    // An escalated Expedion listing is owned by a system account no card
    // belongs to, and its client paid in Expedion when they accepted the quote.
    vi.mocked(paymentsService.hasSavedCard).mockResolvedValue(false);

    await listingsService.createListing(
      "expedion-system",
      createInput({ publish: true }),
      { prepaid: true }
    );

    expect(listingsDal.create).toHaveBeenCalled();
    expect(paymentsService.hasSavedCard).not.toHaveBeenCalled();
  });

  it("skips the check entirely while payments are mocked", async () => {
    // TODO(EXPEDITOO-TESTING): MOCK_PAYMENTS — the charge this guards is mocked too.
    process.env.MOCK_PAYMENTS = "true";
    vi.mocked(paymentsService.hasSavedCard).mockResolvedValue(false);

    const result = await listingsService.publishListing("shipper-1", "job-1");

    expect(result.status).toBe("open");
    expect(paymentsService.hasSavedCard).not.toHaveBeenCalled();
  });
});
