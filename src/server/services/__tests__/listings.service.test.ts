import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/server/dal/listings.dal", () => ({ listingsDal: {} }));
vi.mock("@/server/services/offers.service", () => ({
  offersService: { expirePendingOffers: vi.fn().mockResolvedValue([]) },
}));
vi.mock("@/server/services/notifications.service", () => ({
  notificationsService: { createNotification: vi.fn().mockResolvedValue({}) },
}));

import {
  listingsService,
  resolveExpiresAt,
  ListingError,
} from "../listings.service";
import { listingsDal } from "@/server/dal/listings.dal";
import { offersService } from "@/server/services/offers.service";

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

  it("sends an in-progress job to support rather than self-service", async () => {
    Object.assign(listingsDal, {
      getById: vi.fn().mockResolvedValue(job({ status: "in_progress" })),
    });

    expect(
      await codeFrom(() => listingsService.cancelListing("shipper-1", "job-1"))
    ).toBe("CANCEL_REQUIRES_SUPPORT");
  });

  it("lets an admin cancel an in-progress job", async () => {
    Object.assign(listingsDal, {
      getById: vi.fn().mockResolvedValue(job({ status: "in_progress" })),
    });

    await expect(
      listingsService.cancelListing("admin-1", "job-1", true)
    ).resolves.toBeDefined();
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
