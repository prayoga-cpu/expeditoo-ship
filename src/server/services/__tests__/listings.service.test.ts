import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db", () => ({
  // The transaction boundary is the database's guarantee; what is asserted
  // here is the sequence of writes inside it.
  db: { transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb({})) },
}));
vi.mock("@/server/dal/listings.dal", () => ({ listingsDal: {} }));
vi.mock("@/server/dal/shipments.dal", () => ({ shipmentsDal: {} }));
vi.mock("@/server/services/offers.service", () => ({
  offersService: { expirePendingOffers: vi.fn().mockResolvedValue([]) },
}));
vi.mock("@/server/services/notifications.service", () => ({
  notificationsService: { createNotification: vi.fn().mockResolvedValue({}) },
}));
vi.mock("@/server/services/email.service", () => ({
  emailService: { sendListingPostedEmail: vi.fn().mockResolvedValue(true) },
}));
vi.mock("@/server/services/carrier-route-alerts.service", () => ({
  carrierRouteAlertsService: {
    notifyMatchingCarriers: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("@/server/dal/users.dal", () => ({
  getUserById: vi
    .fn()
    .mockResolvedValue({ id: "user-1", name: "Jane", email: "jane@example.com" }),
}));
vi.mock("@/server/services/account-policy", () => ({
  isSystemAccount: (id: string) => id === "system-account",
}));
// Who is asking decides what of a listing they read (listing_privacy_spec.md).
vi.mock("@/server/services/user.service", () => ({
  hasAnyRole: vi.fn().mockResolvedValue(false),
}));
vi.mock("@/server/dal/carriers.dal", () => ({
  carriersDal: { getByUserId: vi.fn().mockResolvedValue(undefined) },
}));

import {
  listingsService,
  resolveExpiresAt,
  ListingError,
} from "../listings.service";
import { listingsDal } from "@/server/dal/listings.dal";
import { shipmentsDal } from "@/server/dal/shipments.dal";
import { offersService } from "@/server/services/offers.service";
import { notificationsService } from "@/server/services/notifications.service";
import { emailService } from "@/server/services/email.service";
import { carrierRouteAlertsService } from "@/server/services/carrier-route-alerts.service";
import { getUserById } from "@/server/dal/users.dal";
import { hasAnyRole } from "@/server/services/user.service";
import { carriersDal } from "@/server/dal/carriers.dal";

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
    findDueScheduled: vi.fn().mockResolvedValue([]),
    lockDueScheduled: vi.fn().mockResolvedValue(undefined),
    updateUnpublished: vi.fn(async (id, _shipper, data) => ({ ...job(), id, ...data })),
    deleteUnpublished: vi.fn().mockResolvedValue({ id: "job-1" }),
    updateIfStatus: vi.fn(async (id, _status, data) => ({ ...job(), id, ...data })),
    replacePhotos: vi.fn(),
  });
  Object.assign(shipmentsDal, {
    listDeliveredForListings: vi.fn().mockResolvedValue([]),
  });
  vi.mocked(offersService.expirePendingOffers).mockResolvedValue([]);
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
// Finishing a saved request — draft_requests_spec.md §2–§5
// ========================================

describe("listingsService — finishing a saved request", () => {
  const draftInput = (over: Record<string, unknown> = {}) =>
    createInput({ publish: false, photos: ["https://x/a.jpg", "https://x/b.jpg"], ...over });

  it("saves it again as a draft, with its photos, and announces nothing", async () => {
    const view = await listingsService.saveDraft("shipper-1", "job-1", draftInput());

    const [, shipper, columns] = vi.mocked(listingsDal.updateUnpublished).mock.calls[0];
    expect(shipper).toBe("shipper-1");
    expect(columns).toMatchObject({ status: "draft", scheduledPublishAt: null, publishedAt: null });
    expect(listingsDal.replacePhotos).toHaveBeenCalledWith(
      "job-1",
      [
        expect.objectContaining({ url: "https://x/a.jpg", order: 0 }),
        expect.objectContaining({ url: "https://x/b.jpg", order: 1 }),
      ],
      expect.anything()
    );
    expect(notificationsService.createNotification).not.toHaveBeenCalled();
    expect(view).toBeDefined();
  });

  it("writes every field the payload leaves out, so what was cleared is cleared", async () => {
    // An update skips an undefined column: a size, floor, note or packaging
    // state removed while finishing the draft would otherwise survive it.
    await listingsService.saveDraft("shipper-1", "job-1", draftInput());

    const [, , columns] = vi.mocked(listingsDal.updateUnpublished).mock.calls[0];
    expect(columns).toMatchObject({
      lengthCm: null,
      widthCm: null,
      heightCm: null,
      packagingLevel: null,
      pickupFloor: null,
      pickupHasLift: null,
      pickupNote: null,
      pickupContactName: null,
      pickupContactPhone: null,
      dropoffFloor: null,
      dropoffHasLift: null,
      dropoffNote: null,
      dropoffContactName: null,
      dropoffContactPhone: null,
      pickupDays: [1, 2, 3, 4, 5, 6, 7],
      pickupPeriods: ["morning", "afternoon", "evening"],
      dropoffDays: [1, 2, 3, 4, 5, 6, 7],
      dropoffPeriods: ["morning", "afternoon", "evening"],
    });
  });

  it("publishes it now exactly like a new request: dated, announced once", async () => {
    await listingsService.saveDraft("shipper-1", "job-1", draftInput({ publish: true }));

    const [, , columns] = vi.mocked(listingsDal.updateUnpublished).mock.calls[0];
    expect(columns.status).toBe("open");
    expect(columns.publishedAt).toBeInstanceOf(Date);
    expect(notificationsService.createNotification).toHaveBeenCalledTimes(1);
    expect(emailService.sendListingPostedEmail).toHaveBeenCalledTimes(1);
    expect(carrierRouteAlertsService.notifyMatchingCarriers).toHaveBeenCalledTimes(1);
  });

  it("schedules it without announcing anything yet", async () => {
    await listingsService.saveDraft(
      "shipper-1",
      "job-1",
      draftInput({ publish: true, scheduledPublishAt: at(2 * HOUR) })
    );

    const [, , columns] = vi.mocked(listingsDal.updateUnpublished).mock.calls[0];
    expect(columns).toMatchObject({ status: "scheduled", publishedAt: null });
    expect(notificationsService.createNotification).not.toHaveBeenCalled();
  });

  it("keeps the publication rules for publishing, never for a draft", async () => {
    expect(
      await codeFrom(() =>
        listingsService.saveDraft("shipper-1", "job-1", draftInput({ publish: true, pickupFrom: at(-HOUR) }))
      )
    ).toBe("PICKUP_IN_PAST");

    await expect(
      listingsService.saveDraft("shipper-1", "job-1", draftInput({ pickupFrom: at(-HOUR) }))
    ).resolves.toBeDefined();
  });

  it("loses a race cleanly: already live is a conflict, and nothing is announced", async () => {
    vi.mocked(listingsDal.updateUnpublished).mockResolvedValueOnce(undefined);
    Object.assign(listingsDal, { getById: vi.fn().mockResolvedValue(job({ status: "open" })) });

    expect(
      await codeFrom(() => listingsService.saveDraft("shipper-1", "job-1", draftInput({ publish: true })))
    ).toBe("LISTING_NOT_DRAFT");
    expect(listingsDal.replacePhotos).not.toHaveBeenCalled();
    expect(notificationsService.createNotification).not.toHaveBeenCalled();
  });

  it("does not admit someone else's request exists", async () => {
    vi.mocked(listingsDal.updateUnpublished).mockResolvedValueOnce(undefined);
    Object.assign(listingsDal, { getById: vi.fn().mockResolvedValue(job({ status: "draft" })) });

    expect(
      await codeFrom(() => listingsService.saveDraft("intruder", "job-1", draftInput()))
    ).toBe("LISTING_NOT_FOUND");
  });

  it("reads a draft back for its owner only, and only while unpublished", async () => {
    Object.assign(listingsDal, { getById: vi.fn().mockResolvedValue(job({ status: "draft" })) });
    await expect(listingsService.getDraft("shipper-1", "job-1")).resolves.toBeDefined();
    expect(await codeFrom(() => listingsService.getDraft("intruder", "job-1"))).toBe(
      "LISTING_NOT_FOUND"
    );

    Object.assign(listingsDal, { getById: vi.fn().mockResolvedValue(job({ status: "open" })) });
    expect(await codeFrom(() => listingsService.getDraft("shipper-1", "job-1"))).toBe(
      "LISTING_NOT_DRAFT"
    );
  });

  it("deletes a draft, and refuses one that went live meanwhile", async () => {
    await expect(listingsService.deleteDraft("shipper-1", "job-1")).resolves.toEqual({
      deleted: true,
    });

    vi.mocked(listingsDal.deleteUnpublished).mockResolvedValueOnce(undefined);
    Object.assign(listingsDal, { getById: vi.fn().mockResolvedValue(job({ status: "open" })) });
    expect(await codeFrom(() => listingsService.deleteDraft("shipper-1", "job-1"))).toBe(
      "LISTING_NOT_DRAFT"
    );
  });

  it("turns a scheduled request back into a draft", async () => {
    Object.assign(listingsDal, {
      getById: vi.fn().mockResolvedValue(job({ status: "scheduled", scheduledPublishAt: at(HOUR) })),
    });

    await listingsService.unschedule("shipper-1", "job-1");

    expect(listingsDal.updateIfStatus).toHaveBeenCalledWith(
      "job-1",
      "scheduled",
      expect.objectContaining({ status: "draft", scheduledPublishAt: null })
    );
  });

  it("refuses to un-schedule what is not scheduled", async () => {
    vi.mocked(listingsDal.updateIfStatus).mockResolvedValueOnce(undefined);

    expect(await codeFrom(() => listingsService.unschedule("shipper-1", "job-1"))).toBe(
      "LISTING_NOT_SCHEDULED"
    );
  });
});

describe("createListing — the publication date", () => {
  it("dates a request that goes live now, and nothing else", async () => {
    await listingsService.createListing("user-1", createInput());
    await listingsService.createListing("user-1", createInput({ publish: false }));
    await listingsService.createListing(
      "user-1",
      createInput({ scheduledPublishAt: at(24 * HOUR) })
    );

    const rows = vi.mocked(listingsDal.create).mock.calls.map(([row]) => row);
    expect(rows[0].publishedAt).toBeInstanceOf(Date);
    expect(rows[1].publishedAt).toBeNull();
    expect(rows[2].publishedAt).toBeNull();
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

  it("writes the packaging services the request carries", async () => {
    await listingsService.createListing(
      "user-1",
      createInput({ needsProtection: true, needsPackaging: false })
    );

    const row = vi.mocked(listingsDal.create).mock.calls[0][0];
    expect(row.needsProtection).toBe(true);
    expect(row.needsPackaging).toBe(false);
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

  // publication_timing_spec.md §2. This used to be pinned the other way round
  // ("rather than endorsing it"): `resolveExpiresAt` ran for drafts too, and
  // the client got « Le retrait est trop proche… » for pressing « Enregistrer
  // le brouillon ».
  it("saves a draft whose pickup has already passed", async () => {
    const pickupFrom = at(-HOUR);
    await listingsService.createListing(
      "user-1",
      createInput({ pickupFrom, publish: false })
    );

    const row = vi.mocked(listingsDal.create).mock.calls[0][0];
    expect(row.status).toBe("draft");
    // A placeholder for a NOT NULL column nothing reads while it is a draft.
    expect(row.expiresAt).toEqual(pickupFrom);
  });

  it("saves a draft whose pickup is too soon to bid on", async () => {
    await listingsService.createListing(
      "user-1",
      createInput({ pickupFrom: at(0.25 * HOUR), publish: false })
    );

    expect(vi.mocked(listingsDal.create).mock.calls[0][0].status).toBe("draft");
  });

  it("keeps no schedule on a draft, and does not judge it", async () => {
    await listingsService.createListing(
      "user-1",
      createInput({ publish: false, scheduledPublishAt: at(-HOUR) })
    );

    const row = vi.mocked(listingsDal.create).mock.calls[0][0];
    expect(row.status).toBe("draft");
    expect(row.scheduledPublishAt).toBeNull();
  });

  it("still refuses to publish a schedule that has already passed", async () => {
    const code = await codeFrom(() =>
      listingsService.createListing(
        "user-1",
        createInput({ scheduledPublishAt: at(-HOUR) })
      )
    );

    expect(code).toBe("SCHEDULED_PUBLISH_IN_PAST");
  });

  it("still refuses to publish a pickup too soon to bid on", async () => {
    const code = await codeFrom(() =>
      listingsService.createListing(
        "user-1",
        createInput({ pickupFrom: at(0.25 * HOUR) })
      )
    );

    expect(code).toBe("PICKUP_TOO_SOON");
  });

  it("keeps the schedule of a request that will go live later", async () => {
    const scheduledPublishAt = at(2 * HOUR);
    await listingsService.createListing(
      "user-1",
      createInput({ scheduledPublishAt })
    );

    const row = vi.mocked(listingsDal.create).mock.calls[0][0];
    expect(row.status).toBe("scheduled");
    expect(row.scheduledPublishAt).toEqual(scheduledPublishAt);
  });

  // request_availability_spec.md §3
  it("writes the weekdays and times of day the request carries", async () => {
    await listingsService.createListing(
      "user-1",
      createInput({
        isFlexible: true,
        pickupDays: [1, 2, 3],
        pickupPeriods: ["morning", "evening"],
        dropoffDays: [6],
        dropoffPeriods: ["afternoon"],
      })
    );

    const row = vi.mocked(listingsDal.create).mock.calls[0][0];
    expect(row.pickupDays).toEqual([1, 2, 3]);
    expect(row.pickupPeriods).toEqual(["morning", "evening"]);
    expect(row.dropoffDays).toEqual([6]);
    expect(row.dropoffPeriods).toEqual(["afternoon"]);
  });

  it("writes the full set when the request names none — unrestricted, as the column default", async () => {
    await listingsService.createListing("user-1", createInput());

    const row = vi.mocked(listingsDal.create).mock.calls[0][0];
    // Written rather than left undefined: the same columns finish a draft,
    // and an update skips an undefined column (draft_requests_spec.md §3).
    expect(row.pickupDays).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(row.dropoffPeriods).toEqual(["morning", "afternoon", "evening"]);
  });

  // listing_posted_feedback_spec.md §1-2
  describe("submission feedback", () => {
    it("notifies and emails the poster once a request publishes", async () => {
      await listingsService.createListing("user-1", createInput());

      expect(notificationsService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          type: "listing_posted",
        })
      );
      expect(getUserById).toHaveBeenCalledWith("user-1");
      expect(emailService.sendListingPostedEmail).toHaveBeenCalledWith(
        "jane@example.com",
        expect.objectContaining({ recipientName: "Jane" })
      );
    });

    it("names the request by the reference the database gave it", async () => {
      // The sequence issues it on insert (listing_reference_spec.md §5), so it
      // is read from the created row, never from the input.
      vi.mocked(listingsDal.create).mockImplementationOnce(
        async (row) => ({ ...row, reference: 100042 }) as never
      );

      await listingsService.createListing("user-1", createInput());

      expect(notificationsService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("réf. 100042"),
        })
      );
      expect(emailService.sendListingPostedEmail).toHaveBeenCalledWith(
        "jane@example.com",
        expect.objectContaining({ listingReference: 100042 })
      );
    });

    it("stays silent for a draft", async () => {
      await listingsService.createListing(
        "user-1",
        createInput({ publish: false })
      );

      expect(notificationsService.createNotification).not.toHaveBeenCalled();
      expect(emailService.sendListingPostedEmail).not.toHaveBeenCalled();
    });

    // Escalation reaches `createListing` with the system account's id, and
    // nobody signs into that account to read either (listing_posted_feedback_spec.md §1).
    it("stays silent for the Expedion system account, even when publishing", async () => {
      await listingsService.createListing("system-account", createInput());

      expect(notificationsService.createNotification).not.toHaveBeenCalled();
      expect(emailService.sendListingPostedEmail).not.toHaveBeenCalled();
    });

    it("does not let a notification failure fail the listing creation", async () => {
      vi.mocked(notificationsService.createNotification).mockRejectedValueOnce(
        new Error("ably down")
      );

      await expect(
        listingsService.createListing("user-1", createInput())
      ).resolves.toMatchObject({ title: "Two-seater sofa to Marseille" });
    });

    it("does not let an email failure fail the listing creation", async () => {
      vi.mocked(emailService.sendListingPostedEmail).mockRejectedValueOnce(
        new Error("resend down")
      );

      await expect(
        listingsService.createListing("user-1", createInput())
      ).resolves.toMatchObject({ title: "Two-seater sofa to Marseille" });
    });
  });

  // carrier_route_alerts_spec.md §3
  describe("carrier route alerts", () => {
    it("fires on an immediate publish, system account included", async () => {
      await listingsService.createListing("system-account", createInput());

      expect(
        carrierRouteAlertsService.notifyMatchingCarriers
      ).toHaveBeenCalledTimes(1);
    });

    it("stays silent for a draft", async () => {
      await listingsService.createListing(
        "user-1",
        createInput({ publish: false })
      );

      expect(
        carrierRouteAlertsService.notifyMatchingCarriers
      ).not.toHaveBeenCalled();
    });

    it("stays silent for a scheduled publish — publishScheduled fires it later", async () => {
      await listingsService.createListing(
        "user-1",
        createInput({ scheduledPublishAt: at(24 * HOUR) })
      );

      expect(
        carrierRouteAlertsService.notifyMatchingCarriers
      ).not.toHaveBeenCalled();
    });

    it("is skipped when the caller opts out, for assignDirect", async () => {
      await listingsService.createListing("system-account", createInput(), {
        notifyRouteMatches: false,
      });

      expect(
        carrierRouteAlertsService.notifyMatchingCarriers
      ).not.toHaveBeenCalled();
    });

    it("does not let a notify failure fail the listing creation", async () => {
      vi.mocked(
        carrierRouteAlertsService.notifyMatchingCarriers
      ).mockRejectedValueOnce(new Error("db down"));

      await expect(
        listingsService.createListing("user-1", createInput())
      ).resolves.toMatchObject({ title: "Two-seater sofa to Marseille" });
    });
  });
});

// ========================================
// Scheduled publish — scheduled_publish_spec.md, carrier_route_alerts_spec.md §3
// ========================================

describe("publishScheduled", () => {
  const due = (over: Record<string, unknown> = {}) =>
    job({
      id: "job-scheduled",
      status: "scheduled",
      scheduledPublishAt: new Date(),
      pickupFrom: at(48 * HOUR),
      ...over,
    });

  /**
   * The run reads `read`; the row lock then finds `locked` — the same row
   * unless it was saved meanwhile, `null` when it is no longer there to take.
   */
  function queue(read: ReturnType<typeof due>, locked: ReturnType<typeof due> | null = read) {
    vi.mocked(listingsDal.findDueScheduled).mockResolvedValue([read] as never);
    vi.mocked(listingsDal.lockDueScheduled).mockResolvedValue((locked ?? undefined) as never);
    vi.mocked(listingsDal.updateIfStatus).mockImplementation(async (id, _status, data) => ({
      ...(locked ?? read),
      id,
      ...data,
    }) as never);
  }

  it("flips a due listing open and notifies matching carriers", async () => {
    queue(due());

    const published = await listingsService.publishScheduled();

    expect(published).toBe(1);
    expect(listingsDal.updateIfStatus).toHaveBeenCalledWith(
      "job-scheduled",
      "scheduled",
      expect.objectContaining({
        status: "open",
        scheduledPublishAt: null,
        publishedAt: expect.any(Date),
      }),
      expect.anything()
    );
    expect(
      carrierRouteAlertsService.notifyMatchingCarriers
    ).toHaveBeenCalledWith(expect.objectContaining({ id: "job-scheduled" }));
  });

  it("decides each request under its row lock, inside a transaction", async () => {
    const now = new Date();
    queue(due());

    await listingsService.publishScheduled(now);

    const { db } = await import("@/db");
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(listingsDal.lockDueScheduled).toHaveBeenCalledWith("job-scheduled", now, expect.anything());
  });

  it("works from the row as locked, not the copy the run read first", async () => {
    // Saved between the scan and the lock: a new title and a later pickup.
    const now = new Date();
    const pickupFrom = at(96 * HOUR);
    queue(due({ title: "Old title" }), due({ title: "New title", pickupFrom }));

    await listingsService.publishScheduled(now);

    expect(listingsDal.updateIfStatus).toHaveBeenCalledWith(
      "job-scheduled",
      "scheduled",
      expect.objectContaining({ expiresAt: resolveExpiresAt(pickupFrom, now) }),
      expect.anything()
    );
    expect(carrierRouteAlertsService.notifyMatchingCarriers).toHaveBeenCalledWith(
      expect.objectContaining({ title: "New title" })
    );
    expect(notificationsService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("New title") })
    );
  });

  it("leaves a request saved, re-scheduled or deleted since the run read it", async () => {
    // The lock finds it no longer scheduled and due — or held by a save.
    queue(due(), null);

    await expect(listingsService.publishScheduled()).resolves.toBe(0);
    expect(listingsDal.updateIfStatus).not.toHaveBeenCalled();
    expect(notificationsService.createNotification).not.toHaveBeenCalled();
    expect(carrierRouteAlertsService.notifyMatchingCarriers).not.toHaveBeenCalled();
  });

  it("does not notify a listing whose window closed before its scheduled instant fired", async () => {
    queue(due({ pickupFrom: at(-HOUR) }));

    const published = await listingsService.publishScheduled();

    expect(published).toBe(0);
    expect(listingsDal.updateIfStatus).toHaveBeenCalledWith(
      "job-scheduled",
      "scheduled",
      { status: "expired", scheduledPublishAt: null },
      expect.anything()
    );
    expect(
      carrierRouteAlertsService.notifyMatchingCarriers
    ).not.toHaveBeenCalled();
  });

  it("leaves a request that is no longer scheduled alone", async () => {
    // Un-scheduled or published by hand between the lock and the write.
    queue(due());
    vi.mocked(listingsDal.updateIfStatus).mockResolvedValueOnce(undefined);

    await expect(listingsService.publishScheduled()).resolves.toBe(0);
    expect(carrierRouteAlertsService.notifyMatchingCarriers).not.toHaveBeenCalled();
  });

  it("does not let a notify failure stop the publish loop", async () => {
    queue(due());
    vi.mocked(
      carrierRouteAlertsService.notifyMatchingCarriers
    ).mockRejectedValueOnce(new Error("db down"));

    await expect(listingsService.publishScheduled()).resolves.toBe(1);
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

// listing_privacy_spec.md §1–§3
describe("listingsService — what each viewer reads", () => {
  const private_ = (over: Record<string, unknown> = {}) =>
    job({
      pickupAddress: "12 rue de la République",
      pickupContactPhone: "+33612345678",
      pickupNote: "Code 4521B",
      pickupLat: 45.764043,
      externalRef: "quote-9",
      shipper: { id: "shipper-1", name: "Mat", image: null, rating: 0, email: "mat@example.com", stripeCustomerId: "cus_1" },
      ...over,
    });

  // Once, so a viewer set up for one test cannot leak into the next.
  const asApprovedCarrier = () =>
    vi.mocked(carriersDal.getByUserId).mockResolvedValueOnce({ status: "approved" } as never);
  const asStaff = () => vi.mocked(hasAnyRole).mockResolvedValueOnce(true);

  it("gives a stranger the job without the street, the contacts or the account", async () => {
    Object.assign(listingsDal, { getById: vi.fn().mockResolvedValue(private_()) });

    const view = (await listingsService.getListing("job-1", "visitor-9")) as Record<string, unknown>;

    expect(view).not.toHaveProperty("pickupAddress");
    expect(view).not.toHaveProperty("pickupContactPhone");
    expect(view).not.toHaveProperty("pickupNote");
    expect(view.pickupLat).toBe(45.76);
    expect(JSON.stringify(view)).not.toMatch(/mat@example\.com|cus_1/);
  });

  it("gives a signed-out visitor the same", async () => {
    Object.assign(listingsDal, { getById: vi.fn().mockResolvedValue(private_()) });

    const view = (await listingsService.getListing("job-1", null)) as Record<string, unknown>;

    expect(view).not.toHaveProperty("pickupAddress");
  });

  it("gives the owner everything of their own request", async () => {
    Object.assign(listingsDal, { getById: vi.fn().mockResolvedValue(private_()) });

    const view = (await listingsService.getListing("job-1", "shipper-1")) as Record<string, unknown>;

    expect(view.pickupAddress).toBe("12 rue de la République");
    expect(view.pickupContactPhone).toBe("+33612345678");
    expect(JSON.stringify(view)).not.toMatch(/mat@example\.com/);
  });

  it("projects every job on the board and keeps the paging", async () => {
    Object.assign(listingsDal, {
      browse: vi.fn().mockResolvedValue({ items: [private_()], total: 1 }),
    });

    const result = await listingsService.browse({ page: 1, limit: 20 } as never, "visitor-9");

    expect(result.total).toBe(1);
    expect(result.items[0]).not.toHaveProperty("pickupContactPhone");
    expect(JSON.stringify(result)).not.toMatch(/mat@example\.com/);
  });

  it("gives an approved carrier the street and the exact pin, never the contacts", async () => {
    Object.assign(listingsDal, { getById: vi.fn().mockResolvedValue(private_()) });
    asApprovedCarrier();

    const view = (await listingsService.getListing("job-1", "carrier-9")) as Record<string, unknown>;

    expect(view.pickupAddress).toBe("12 rue de la République");
    expect(view.pickupLat).toBe(45.764043);
    expect(view).not.toHaveProperty("pickupContactPhone");
    expect(view).not.toHaveProperty("pickupNote");
    expect(view).not.toHaveProperty("externalRef");
  });

  it("gives staff the request in full, as its owner reads it", async () => {
    Object.assign(listingsDal, { getById: vi.fn().mockResolvedValue(private_()) });
    asStaff();

    const view = (await listingsService.getListing("job-1", "operator-9")) as Record<string, unknown>;

    expect(view.pickupContactPhone).toBe("+33612345678");
    expect(view.pickupNote).toBe("Code 4521B");
    expect(view.externalRef).toBe("quote-9");
    expect(view.pickupLat).toBe(45.764043);
    // The admin endpoints carry the requester's email; this one does not.
    expect(JSON.stringify(view)).not.toMatch(/mat@example\.com|cus_1/);
  });

  it("hides a scheduled request from everyone but its author, as a draft", async () => {
    // Decided before who is asking is even looked up: not yet on the board
    // belongs to its author alone.
    Object.assign(listingsDal, {
      getById: vi.fn().mockResolvedValue(private_({ status: "scheduled" })),
    });

    expect(await codeFrom(() => listingsService.getListing("job-1", "carrier-9"))).toBe(
      "LISTING_NOT_FOUND"
    );
    await expect(listingsService.getListing("job-1", "shipper-1")).resolves.toMatchObject({
      status: "scheduled",
    });
  });

  it("searches a plain account's board on the rounded pins", async () => {
    // A radius search on the exact pin gives the pin back one question at a
    // time, whatever the card rounds it to.
    await listingsService.browse({ page: 1, limit: 20 } as never, "visitor-9");

    expect(listingsDal.browse).toHaveBeenCalledWith(expect.anything(), {
      exactLocation: false,
    });
  });

  it("gives an approved carrier the board with streets and exact pins, searched exactly", async () => {
    Object.assign(listingsDal, {
      browse: vi.fn().mockResolvedValue({ items: [private_()], total: 1 }),
    });
    asApprovedCarrier();

    const result = await listingsService.browse({ page: 1, limit: 20 } as never, "carrier-9");
    const [item] = result.items as Record<string, unknown>[];

    expect(listingsDal.browse).toHaveBeenCalledWith(expect.anything(), {
      exactLocation: true,
    });
    expect(item.pickupAddress).toBe("12 rue de la République");
    expect(item.pickupLat).toBe(45.764043);
    expect(item).not.toHaveProperty("pickupContactPhone");
  });

  it("gives staff the board in full, searched exactly", async () => {
    Object.assign(listingsDal, {
      browse: vi.fn().mockResolvedValue({ items: [private_()], total: 1 }),
    });
    asStaff();

    const result = await listingsService.browse({ page: 1, limit: 20 } as never, "operator-9");
    const [item] = result.items as Record<string, unknown>[];

    expect(listingsDal.browse).toHaveBeenCalledWith(expect.anything(), {
      exactLocation: true,
    });
    expect(item.pickupNote).toBe("Code 4521B");
    expect(item.externalRef).toBe("quote-9");
  });

  it("shows the viewer their own request in full beside someone else's", async () => {
    Object.assign(listingsDal, {
      browse: vi.fn().mockResolvedValue({
        items: [private_(), private_({ id: "job-2", shipperId: "someone-else" })],
        total: 2,
      }),
    });

    const result = await listingsService.browse({ page: 1, limit: 20 } as never, "shipper-1");
    const [own, theirs] = result.items as Record<string, unknown>[];

    expect(own.pickupContactPhone).toBe("+33612345678");
    expect(own.pickupLat).toBe(45.764043);
    expect(theirs).not.toHaveProperty("pickupAddress");
    expect(theirs.pickupLat).toBe(45.76);
    // Their own row reads in full; the search does not — they are not vetted.
    expect(listingsDal.browse).toHaveBeenCalledWith(expect.anything(), {
      exactLocation: false,
    });
  });

  it("hands the owner their own list through the full view, not whole", async () => {
    // GET /api/listings/me: the owner's, so everything classified — but a key
    // nobody classified stays behind, as on every other listing route.
    vi.mocked(listingsDal.getByShipperId).mockResolvedValue([
      private_({
        somethingNew: "secret",
        photos: [{ id: "p1", url: "https://x/p1.jpg", order: 0, listingId: "job-1" }],
      }),
    ] as never);

    const [row] = await listingsService.getMyListings("shipper-1");

    expect(row.pickupContactPhone).toBe("+33612345678");
    expect(row.externalRef).toBe("quote-9");
    expect(row).not.toHaveProperty("somethingNew");
    expect(row.photos).toEqual([{ id: "p1", url: "https://x/p1.jpg", order: 0 }]);
    expect(row.delivery).toBeNull();
  });
});

