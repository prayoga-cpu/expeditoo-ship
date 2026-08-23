import { describe, it, expect, vi, beforeEach } from "vitest";

import { expedionEscalationService } from "../expedion-escalation.service";
import { expedionDal } from "@/server/dal/expedion.dal";
import { carriersDal } from "@/server/dal/carriers.dal";
import { userHasRole } from "@/server/dal/users.dal";
import { offersService } from "@/server/services/offers.service";

/**
 * `assignDirect` — handing a paid job to a driver in the pool.
 *
 * What is pinned here is that it is an *escalation with a pre-selected
 * winner*, not a second execution path. The old assignment wrote
 * `assignedCarrierId` onto the quote and stopped: no listing, no shipment, no
 * payment hold, so the driver never saw the job and nothing but an admin
 * editing status by hand could carry it to `delivered`. Every test below is
 * about that award machinery being reached, and about the two carrier id
 * spaces being crossed correctly on the way.
 */

vi.mock("@/server/dal/expedion.dal", () => ({
  expedionDal: {
    getById: vi.fn(),
    update: vi.fn(),
    addEvent: vi.fn(),
    claimForEscalation: vi.fn(),
  },
}));

vi.mock("@/server/dal/carriers.dal", () => ({
  carriersDal: { getById: vi.fn(), getByUserId: vi.fn() },
}));

vi.mock("@/server/dal/users.dal", () => ({ userHasRole: vi.fn() }));

vi.mock("@/server/dal/listings.dal", () => ({
  listingsDal: { getByExternalRef: vi.fn(), update: vi.fn() },
}));

vi.mock("@/server/services/listings.service", () => ({
  listingsService: { createListing: vi.fn() },
}));

vi.mock("@/server/services/offers.service", () => ({
  offersService: { submitOffer: vi.fn(), acceptOffer: vi.fn() },
}));

vi.mock("@/server/services/expedion-sms.service", () => ({
  expedionSmsService: {
    deliveryUpdate: vi.fn().mockResolvedValue(undefined),
  },
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

const getQuote = vi.mocked(expedionDal.getById);
const getCarrier = vi.mocked(carriersDal.getById);
const hasRole = vi.mocked(userHasRole);
// `submitOffer`, not `offersDal.create`: it is what validates the vehicle can
// carry the load, that the vehicle belongs to this carrier, and that the
// carrier is approved — and what keeps `listings.offers_count` honest.
const submitOffer = vi.mocked(offersService.submitOffer);
const acceptOffer = vi.mocked(offersService.acceptOffer);
const escalateSpy = vi.spyOn(expedionEscalationService, "escalate");

/** A paid quote with nobody carrying it — the state the fork serves. */
const paidQuote = (over: Record<string, unknown> = {}) => ({
  id: "q_1",
  status: "paid",
  paymentStatus: "paid",
  acceptedPriceCents: 10_000,
  assignedCarrierId: null,
  listingId: null,
  ...over,
});

/**
 * The picker yields a `carriers.id`; `offers.carrier_id` references `user.id`.
 * The two are deliberately different strings here so a test cannot pass by
 * confusing them.
 */
const approvedCarrier = (over: Record<string, unknown> = {}) => ({
  id: "car_1",
  userId: "usr_driver",
  status: "approved",
  vehicles: [{ id: "veh_1", isActive: true }],
  ...over,
});

const listing = {
  id: "lst_1",
  pickupFrom: new Date("2026-08-25T08:00:00.000Z"),
  dropoffFrom: new Date("2026-08-26T08:00:00.000Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  hasRole.mockResolvedValue(true as never);
  escalateSpy.mockResolvedValue({ quote: paidQuote(), listing } as never);
  submitOffer.mockImplementation(
    async (carrierUserId, listingId, data) =>
      ({ id: "off_1", carrierId: carrierUserId, listingId, ...data }) as never
  );
  acceptOffer.mockResolvedValue({ shipment: { id: "shp_1" } } as never);
});

describe("expedionEscalationService.assignDirect", () => {
  it("escalates, then awards the chosen driver", async () => {
    getQuote.mockResolvedValue(paidQuote() as never);
    getCarrier.mockResolvedValue(approvedCarrier() as never);

    const result = await expedionEscalationService.assignDirect(
      "q_1",
      "car_1",
      "usr_operator"
    );

    expect(escalateSpy).toHaveBeenCalledWith("q_1", expect.anything());
    expect(acceptOffer).toHaveBeenCalledWith("usr_operator", expect.anything());
    expect(result.shipment).toMatchObject({ id: "shp_1" });
  });

  // The trap this whole path has to get right: a `carriers.id` in, a `user.id`
  // on the offer. Writing the wrong one raises a foreign-key violation that
  // the write-back then swallows.
  it("maps the carrier row id onto the offer's user id", async () => {
    getQuote.mockResolvedValue(paidQuote() as never);
    getCarrier.mockResolvedValue(approvedCarrier() as never);

    await expedionEscalationService.assignDirect("q_1", "car_1", "usr_operator");

    expect(submitOffer).toHaveBeenCalledWith(
      "usr_driver",
      "lst_1",
      expect.objectContaining({ vehicleId: "veh_1" })
    );
  });

  // There is no negotiation on this lane, so the offer is written at what the
  // client already paid rather than at anything bid down from it.
  it("prices the offer at what the client paid", async () => {
    getQuote.mockResolvedValue(paidQuote({ acceptedPriceCents: 12_345 }) as never);
    getCarrier.mockResolvedValue(approvedCarrier() as never);

    await expedionEscalationService.assignDirect("q_1", "car_1", "usr_operator");

    expect(submitOffer).toHaveBeenCalledWith(
      "usr_driver",
      "lst_1",
      expect.objectContaining({ priceCents: 12_345 })
    );
  });

  it("prefers an active vehicle over a retired one", async () => {
    getQuote.mockResolvedValue(paidQuote() as never);
    getCarrier.mockResolvedValue(
      approvedCarrier({
        vehicles: [
          { id: "veh_old", isActive: false },
          { id: "veh_new", isActive: true },
        ],
      }) as never
    );

    await expedionEscalationService.assignDirect("q_1", "car_1", "usr_operator");

    expect(submitOffer).toHaveBeenCalledWith(
      "usr_driver",
      "lst_1",
      expect.objectContaining({ vehicleId: "veh_new" })
    );
  });

  it("refuses a quote the client has not paid for", async () => {
    getQuote.mockResolvedValue(
      paidQuote({ status: "accepted", paymentStatus: "unpaid" }) as never
    );

    await expect(
      expedionEscalationService.assignDirect("q_1", "car_1", "usr_operator")
    ).rejects.toMatchObject({ code: "QUOTE_NOT_PAID", status: 409 });
    expect(escalateSpy).not.toHaveBeenCalled();
  });

  it("refuses a job already on the marketplace", async () => {
    getQuote.mockResolvedValue(paidQuote({ listingId: "lst_0" }) as never);

    await expect(
      expedionEscalationService.assignDirect("q_1", "car_1", "usr_operator")
    ).rejects.toMatchObject({ code: "ALREADY_ESCALATED", status: 409 });
    expect(escalateSpy).not.toHaveBeenCalled();
  });

  // The driver is checked *before* anything is created. Discovering an
  // unusable carrier afterwards would leave the job published as a side effect
  // of an assignment that never happened.
  it("refuses an unapproved driver without publishing anything", async () => {
    getQuote.mockResolvedValue(paidQuote() as never);
    getCarrier.mockResolvedValue(approvedCarrier({ status: "suspended" }) as never);

    await expect(
      expedionEscalationService.assignDirect("q_1", "car_1", "usr_operator")
    ).rejects.toMatchObject({ code: "CARRIER_NOT_APPROVED", status: 409 });
    expect(escalateSpy).not.toHaveBeenCalled();
    expect(submitOffer).not.toHaveBeenCalled();
  });

  it("refuses a driver with no vehicle, since an offer must name one", async () => {
    getQuote.mockResolvedValue(paidQuote() as never);
    getCarrier.mockResolvedValue(approvedCarrier({ vehicles: [] }) as never);

    await expect(
      expedionEscalationService.assignDirect("q_1", "car_1", "usr_operator")
    ).rejects.toMatchObject({ code: "CARRIER_HAS_NO_VEHICLE", status: 409 });
    expect(escalateSpy).not.toHaveBeenCalled();
  });

  it("is a 404 for a quote that does not exist", async () => {
    getQuote.mockResolvedValue(undefined as never);

    await expect(
      expedionEscalationService.assignDirect("nope", "car_1", "usr_operator")
    ).rejects.toMatchObject({ code: "QUOTE_NOT_FOUND", status: 404 });
  });

  // `acceptOffer` checks this too, but by then `escalate` has already put the
  // job on the marketplace — so a caller who cannot award would have escalated
  // a quote as a side effect of an assignment that was always going to fail.
  // The shared-key path is exactly that caller: its `userId` is whatever
  // `x-expedion-uid` claimed, with no account behind it.
  it("refuses a caller who cannot award, before anything is published", async () => {
    getQuote.mockResolvedValue(paidQuote() as never);
    getCarrier.mockResolvedValue(approvedCarrier() as never);
    hasRole.mockResolvedValue(false as never);

    await expect(
      expedionEscalationService.assignDirect("q_1", "car_1", "payment-server")
    ).rejects.toMatchObject({ code: "FORBIDDEN_NOT_OPERATOR", status: 403 });
    expect(escalateSpy).not.toHaveBeenCalled();
    expect(submitOffer).not.toHaveBeenCalled();
  });

  // The client is about to be told a named driver has their job. Telling them
  // first that it went out to tender is worse than telling them nothing.
  it("escalates quietly, as a direct assignment", async () => {
    getQuote.mockResolvedValue(paidQuote() as never);
    getCarrier.mockResolvedValue(approvedCarrier() as never);

    await expedionEscalationService.assignDirect("q_1", "car_1", "usr_operator");

    expect(escalateSpy).toHaveBeenCalledWith(
      "q_1",
      expect.objectContaining({ directAssignment: true })
    );
  });

  // Past the escalation the job is live on the marketplace, so a failure is
  // not a dead end — but the operator has to be told which failure it was and
  // that the job is still awardable, not handed a bare 500.
  it("reports an award failure as itself, naming the live listing", async () => {
    getQuote.mockResolvedValue(paidQuote() as never);
    getCarrier.mockResolvedValue(approvedCarrier() as never);
    acceptOffer.mockRejectedValue(
      Object.assign(new Error("Carrier is no longer approved"), {
        code: "CARRIER_NO_LONGER_APPROVED",
        status: 409,
      }) as never
    );

    await expect(
      expedionEscalationService.assignDirect("q_1", "car_1", "usr_operator")
    ).rejects.toMatchObject({
      code: "CARRIER_NO_LONGER_APPROVED",
      status: 409,
      message: expect.stringContaining("lst_1"),
    });
  });

  it("does not let an unrecognised failure leak as a raw error", async () => {
    getQuote.mockResolvedValue(paidQuote() as never);
    getCarrier.mockResolvedValue(approvedCarrier() as never);
    submitOffer.mockRejectedValue(new Error("boom") as never);

    await expect(
      expedionEscalationService.assignDirect("q_1", "car_1", "usr_operator")
    ).rejects.toMatchObject({ code: "ASSIGNMENT_FAILED", status: 500 });
  });
});
