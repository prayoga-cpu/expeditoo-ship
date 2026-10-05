import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db", () => ({ db: { transaction: vi.fn() } }));
vi.mock("@/server/dal/offers.dal", () => ({ offersDal: {} }));
vi.mock("@/server/dal/listings.dal", () => ({ listingsDal: {} }));
vi.mock("@/server/dal/carriers.dal", () => ({ carriersDal: {} }));
vi.mock("@/server/dal/users.dal", () => ({ userHasRole: vi.fn() }));
vi.mock("@/server/services/notifications.service", () => ({
  notificationsService: { createNotification: vi.fn() },
}));
vi.mock("@/server/services/payments.service", () => ({ paymentsService: {} }));
vi.mock("@/server/services/expedion-bridge.service", () => ({
  expedionBridgeService: {},
  notifyExpedion: vi.fn(),
}));

import { offersService } from "../offers.service";
import { offersDal } from "@/server/dal/offers.dal";
import { listingsDal } from "@/server/dal/listings.dal";

/**
 * Bids carry two people's accounts: the carrier who placed them, and — inside
 * a carrier's own list — the job's requester. Neither leaves whole
 * (listing_privacy_spec.md §3).
 */

const carrierAccount = {
  id: "carrier-1",
  name: "Transports Martin",
  image: null,
  rating: 4.8,
  email: "martin@example.com",
  stripeAccountId: "acct_martin",
  preferences: { notifications: {} },
};

const vehicle = {
  id: "v1",
  type: "van",
  make: "Renault",
  model: "Master",
  maxWeightKg: 1200,
  maxLengthCm: 360,
  maxWidthCm: 170,
  maxHeightCm: 180,
  plateNumber: "AB-123-CD",
  carrierId: "carrier-row-1",
};

beforeEach(() => {
  Object.assign(listingsDal, {
    getById: vi.fn().mockResolvedValue({ id: "job-1", shipperId: "requester-1" }),
  });
  Object.assign(offersDal, {
    listByListing: vi.fn().mockResolvedValue([
      { id: "o1", carrierId: "carrier-1", priceCents: 15_000, carrier: carrierAccount, vehicle },
    ]),
    listByCarrier: vi.fn().mockResolvedValue([
      {
        id: "o1",
        carrierId: "carrier-1",
        listing: {
          id: "job-1",
          shipperId: "requester-1",
          pickupAddress: "12 rue de la République",
          pickupContactPhone: "+33612345678",
          pickupNote: "Code 4521B",
          externalRef: "quote-9",
        },
      },
    ]),
  });
});

describe("the requester's list of bids", () => {
  it("shows each carrier as a name, a face and a rating", async () => {
    const result = await offersService.getOffersForViewer("job-1", "requester-1");
    if (result.scope !== "full") throw new Error("expected the full scope");

    expect(result.offers[0].carrier).toEqual({
      id: "carrier-1",
      name: "Transports Martin",
      image: null,
      rating: 4.8,
    });
    expect(JSON.stringify(result)).not.toMatch(/martin@example\.com|acct_martin/);
  });

  it("shows the vehicle without its plate", async () => {
    const result = await offersService.getOffersForViewer("job-1", "requester-1");
    if (result.scope !== "full") throw new Error("expected the full scope");

    expect(result.offers[0].vehicle).not.toHaveProperty("plateNumber");
    expect(result.offers[0].vehicle).toMatchObject({ make: "Renault", maxWeightKg: 1200 });
  });
});

describe("a carrier's own bids", () => {
  it("carry the job without its contacts, notes or Expedion reference", async () => {
    const [offer] = await offersService.getCarrierOffers("carrier-1", { page: 1, limit: 20 });
    const listing = offer.listing as Record<string, unknown>;

    // An approved carrier prices on the street…
    expect(listing.pickupAddress).toBe("12 rue de la République");
    // …and gets the people and the door codes with the shipment, if they win.
    expect(listing).not.toHaveProperty("pickupContactPhone");
    expect(listing).not.toHaveProperty("pickupNote");
    expect(listing).not.toHaveProperty("externalRef");
  });
});
