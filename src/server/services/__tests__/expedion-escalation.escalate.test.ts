import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * `escalate` itself, un-mocked — a separate file from
 * `expedion-escalation.service.test.ts`, which spies `escalate` out for every
 * `assignDirect` test and has no coverage of the real implementation.
 *
 * The one thing pinned here: `createListing`'s third argument,
 * `{ notifyRouteMatches }`, tracks `opts.directAssignment` exactly the way the
 * client SMS a few lines below it already does — see
 * carrier_route_alerts_spec.md §3.
 */

vi.mock("@/server/dal/expedion.dal", () => ({
  expedionDal: {
    getById: vi.fn(),
    update: vi.fn(),
    addEvent: vi.fn(),
    claimForEscalation: vi.fn(),
  },
}));

vi.mock("@/server/dal/listings.dal", () => ({
  listingsDal: { getByExternalRef: vi.fn(), update: vi.fn() },
}));

vi.mock("@/server/services/listings.service", () => ({
  listingsService: { createListing: vi.fn() },
}));

vi.mock("@/server/services/offers.service", () => ({
  offersService: { submitOffer: vi.fn(), acceptOffer: vi.fn() },
}));

vi.mock("@/server/dal/carriers.dal", () => ({
  carriersDal: { getById: vi.fn(), getByUserId: vi.fn() },
}));

vi.mock("@/server/dal/users.dal", () => ({ userHasRole: vi.fn() }));

vi.mock("@/server/services/expedion-sms.service", () => ({
  expedionSmsService: { deliveryUpdate: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("@/server/services/expedion-realtime.service", () => ({
  notifyExpedionAdmins: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/db", () => ({
  db: {
    transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb({})),
    query: { categories: { findFirst: vi.fn() } },
    select: vi.fn(),
  },
}));

import { expedionEscalationService } from "../expedion-escalation.service";
import { expedionDal } from "@/server/dal/expedion.dal";
import { listingsDal } from "@/server/dal/listings.dal";
import { listingsService } from "@/server/services/listings.service";
import { db } from "@/db";

/** A paid quote with every field `escalationBlockers` requires. */
const paidQuote = (over: Record<string, unknown> = {}) => ({
  id: "q_1",
  status: "paid",
  paymentStatus: "paid",
  listingId: null,
  acceptedPriceCents: 10_000,
  weightKg: 40,
  pickupLat: 45.75,
  pickupLng: 4.85,
  pickupAddress: "1 rue de la Vente",
  pickupCity: "Lyon",
  pickupPostalCode: "69000",
  deliveryLat: 43.3,
  deliveryLng: 5.37,
  deliveryAddress: "2 rue du Client",
  deliveryCity: "Marseille",
  deliveryPostalCode: "13000",
  photoUrls: [],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env.EXPEDION_SYSTEM_USER_ID = "system-account";

  vi.mocked(expedionDal.getById).mockResolvedValue(paidQuote() as never);
  vi.mocked(expedionDal.claimForEscalation).mockResolvedValue(true as never);
  vi.mocked(expedionDal.update).mockResolvedValue({
    phone: "+33600000000",
    bordereauNumber: "B1",
  } as never);
  vi.mocked(expedionDal.addEvent).mockResolvedValue(undefined as never);
  vi.mocked(listingsDal.getByExternalRef).mockResolvedValue(undefined as never);
  vi.mocked(listingsDal.update).mockResolvedValue(undefined as never);
  vi.mocked(listingsService.createListing).mockResolvedValue({
    id: "lst_new",
  } as never);
  vi.mocked(db.query.categories.findFirst).mockResolvedValue({
    id: "cat-encheres",
  } as never);
});

afterEach(() => {
  delete process.env.EXPEDION_SYSTEM_USER_ID;
});

describe("expedionEscalationService.escalate — carrier route alerts", () => {
  it("tells createListing to notify matching carriers on a normal escalation", async () => {
    await expedionEscalationService.escalate("q_1", {});

    expect(listingsService.createListing).toHaveBeenCalledWith(
      "system-account",
      expect.anything(),
      { notifyRouteMatches: true }
    );
  });

  it("suppresses it on a direct assignment, the same way the client SMS is suppressed", async () => {
    await expedionEscalationService.escalate("q_1", { directAssignment: true });

    expect(listingsService.createListing).toHaveBeenCalledWith(
      "system-account",
      expect.anything(),
      { notifyRouteMatches: false }
    );
  });

  it("does not call createListing a second time when a prior attempt already left a listing behind", async () => {
    // The orphan-adoption path (§ "A previous attempt can die..."): a retry
    // finds the listing by externalRef and never re-creates it, so it never
    // re-fires the alert either.
    vi.mocked(listingsDal.getByExternalRef).mockResolvedValue({
      id: "lst_adopted",
    } as never);

    await expedionEscalationService.escalate("q_1", {});

    expect(listingsService.createListing).not.toHaveBeenCalled();
  });
});
