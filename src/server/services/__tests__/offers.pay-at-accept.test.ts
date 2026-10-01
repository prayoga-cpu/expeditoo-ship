import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * docs/specs/pay_at_accept_spec.md §6, the offers half: the award's checks run
 * before a card is touched, the authorised intent reaches the charge, and an
 * authorisation the award did not use is released — but never somebody
 * else's, and never the one the requester's own first request is capturing.
 */

vi.mock("@/db", () => ({
  db: { transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb({})) },
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
    quoteCharge: vi.fn(),
    authoriseForAccept: vi.fn(),
    releaseAcceptIntent: vi.fn(),
    getForShipment: vi.fn(),
  },
}));
vi.mock("@/server/services/stripe.service", () => ({
  stripeService: { getOrCreateCustomer: vi.fn().mockResolvedValue("cus_new") },
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
import { stripeService } from "@/server/services/stripe.service";

const HOUR = 60 * 60 * 1000;
const soon = (ms: number) => new Date(Date.now() + ms);

const listing = (over: Record<string, unknown> = {}) => ({
  id: "job-1",
  shipperId: "shipper-1",
  origin: "direct",
  status: "open",
  title: "Sofa to Lyon",
  acceptedOfferId: null,
  pickupFrom: soon(24 * HOUR),
  pickupUntil: soon(32 * HOUR),
  expiresAt: soon(18 * HOUR),
  pickupLat: 48.86,
  pickupLng: 2.35,
  dropoffLat: 45.76,
  dropoffLng: 4.84,
  shipper: { stripeCustomerId: "cus_1" },
  ...over,
});

const offer = (over: Record<string, unknown> = {}) => ({
  id: "offer-1",
  listingId: "job-1",
  carrierId: "carrier-1",
  priceCents: 18_000,
  estimatedPickup: soon(25 * HOUR),
  estimatedDelivery: soon(48 * HOUR),
  slots: [],
  status: "pending",
  ...over,
});

const AWARD = { offerId: "offer-1", listingId: "job-1", shipperId: "shipper-1" };

async function codeFrom(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof OfferError) return error.code;
    throw error;
  }
  throw new Error("expected the call to throw");
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(carriersDal, {
    getByUserId: vi.fn().mockResolvedValue({ id: "c-1", status: "approved" }),
  });
  Object.assign(offersDal, {
    getById: vi.fn().mockResolvedValue(offer()),
    getByIdForUpdate: vi.fn().mockResolvedValue(offer()),
    updateStatus: vi.fn(async (id, status) => ({ id, status })),
    setPendingStatusForListing: vi.fn().mockResolvedValue([]),
    incrementListingOffersCount: vi.fn(),
  });
  Object.assign(listingsDal, {
    getById: vi.fn().mockResolvedValue(listing()),
    getByIdForUpdate: vi.fn().mockResolvedValue(listing()),
    update: vi.fn(),
    createShipment: vi.fn(async (row) => row),
    getShipmentByOfferId: vi.fn().mockResolvedValue({ id: "ship-1" }),
  });
  vi.mocked(paymentsService.chargeForShipment).mockResolvedValue({
    id: "pay-1",
  } as never);
});

// ========================================
// The quote — §3.1
// ========================================

describe("offersService.paymentQuote", () => {
  it("quotes a direct job's charge against the owner's customer", async () => {
    vi.mocked(paymentsService.quoteCharge).mockResolvedValue({
      required: true,
    } as never);

    const quote = await offersService.paymentQuote("shipper-1", "offer-1");

    expect(paymentsService.quoteCharge).toHaveBeenCalledWith({
      amountCents: 18_000,
      stripeCustomerId: "cus_1",
    });
    expect(quote).toEqual({ required: true });
  });

  it("shows an operator the bid and nothing to pay on an escalated job", async () => {
    vi.mocked(listingsDal.getById).mockResolvedValue(
      listing({ origin: "expedion", shipperId: "expedion-system" }) as never
    );
    vi.mocked(userHasRole).mockImplementation(async (_id, role) => role === "operator");

    const quote = await offersService.paymentQuote("op-1", "offer-1");

    expect(quote).toMatchObject({
      required: false,
      reason: "prepaid",
      totalCents: 18_000,
      platformFeeCents: 0,
      savedCard: null,
    });
    expect(paymentsService.quoteCharge).not.toHaveBeenCalled();
  });

  it("refuses someone who may not award the job", async () => {
    expect(await codeFrom(() => offersService.paymentQuote("someone", "offer-1")))
      .toBe("FORBIDDEN_NOT_SHIPPER");
    expect(paymentsService.quoteCharge).not.toHaveBeenCalled();
  });

  it.each([
    ["an offer no longer pending", () => vi.mocked(offersDal.getById).mockResolvedValue(offer({ status: "withdrawn" }) as never), "OFFER_NOT_PENDING"],
    ["a job already awarded", () => vi.mocked(listingsDal.getById).mockResolvedValue(listing({ acceptedOfferId: "offer-9" }) as never), "LISTING_NOT_OPEN"],
    ["a job with no map pin", () => vi.mocked(listingsDal.getById).mockResolvedValue(listing({ dropoffLat: null, dropoffLng: null }) as never), "COORDINATES_REQUIRED"],
    ["a carrier suspended since bidding", () => vi.mocked(carriersDal.getByUserId).mockResolvedValue({ id: "c-1", status: "suspended" } as never), "CARRIER_NO_LONGER_APPROVED"],
  ])("refuses %s before any card is touched", async (_label, arrange, code) => {
    arrange();

    expect(await codeFrom(() => offersService.paymentQuote("shipper-1", "offer-1")))
      .toBe(code);
    expect(paymentsService.quoteCharge).not.toHaveBeenCalled();
  });
});

// ========================================
// Authorising — §3.2
// ========================================

describe("offersService.preparePayment", () => {
  it("authorises the owner's card for exactly this award", async () => {
    vi.mocked(paymentsService.authoriseForAccept).mockResolvedValue({
      paymentIntentId: "pi_1",
    } as never);

    await offersService.preparePayment("shipper-1", "offer-1", {
      method: "new",
      saveCard: true,
    });

    expect(paymentsService.authoriseForAccept).toHaveBeenCalledWith(
      expect.objectContaining({
        shipperId: "shipper-1",
        offerId: "offer-1",
        listingId: "job-1",
        amountCents: 18_000,
        method: "new",
        saveCard: true,
      })
    );
  });

  it("creates a Stripe customer only when the payments side asks for one", async () => {
    vi.mocked(paymentsService.authoriseForAccept).mockResolvedValue({} as never);

    await offersService.preparePayment("shipper-1", "offer-1", {
      method: "saved",
      saveCard: false,
    });
    expect(stripeService.getOrCreateCustomer).not.toHaveBeenCalled();

    const { resolveCustomer } = vi.mocked(paymentsService.authoriseForAccept).mock
      .calls[0][0];
    expect(await resolveCustomer()).toBe("cus_new");
    expect(stripeService.getOrCreateCustomer).toHaveBeenCalledWith("shipper-1");
  });

  it("refuses an escalated job, whose client paid in Expedion", async () => {
    vi.mocked(listingsDal.getById).mockResolvedValue(
      listing({ origin: "expedion", shipperId: "expedion-system" }) as never
    );
    vi.mocked(userHasRole).mockImplementation(async (_id, role) => role === "operator");

    expect(
      await codeFrom(() =>
        offersService.preparePayment("op-1", "offer-1", { method: "new", saveCard: false })
      )
    ).toBe("PAYMENT_NOT_REQUIRED");
    expect(paymentsService.authoriseForAccept).not.toHaveBeenCalled();
  });

  it("refuses a non-owner without touching Stripe", async () => {
    expect(
      await codeFrom(() =>
        offersService.preparePayment("someone", "offer-1", { method: "saved", saveCard: false })
      )
    ).toBe("FORBIDDEN_NOT_SHIPPER");
    expect(paymentsService.authoriseForAccept).not.toHaveBeenCalled();
    expect(stripeService.getOrCreateCustomer).not.toHaveBeenCalled();
  });
});

// ========================================
// Accepting with an authorised card — §3.3, §3.4
// ========================================

describe("offersService.acceptOffer with a paymentIntentId", () => {
  const accept = (actor = "shipper-1") =>
    offersService.acceptOffer(actor, "offer-1", { paymentIntentId: "pi_1" });

  it("hands the intent and the offer to the charge", async () => {
    await accept();

    expect(paymentsService.chargeForShipment).toHaveBeenCalledWith(
      expect.objectContaining({
        offerId: "offer-1",
        paymentIntentId: "pi_1",
        source: "stripe",
        amountCents: 18_000,
      })
    );
    expect(paymentsService.releaseAcceptIntent).not.toHaveBeenCalled();
  });

  it("releases the authorisation when the award is refused", async () => {
    vi.mocked(listingsDal.getByIdForUpdate).mockResolvedValue(
      listing({ status: "cancelled" }) as never
    );

    expect(await codeFrom(accept)).toBe("LISTING_NOT_OPEN");
    expect(paymentsService.releaseAcceptIntent).toHaveBeenCalledWith("pi_1", AWARD);
  });

  it("releases it when the offer was withdrawn meanwhile", async () => {
    vi.mocked(offersDal.getById).mockResolvedValue(offer({ status: "withdrawn" }) as never);

    expect(await codeFrom(accept)).toBe("OFFER_NOT_PENDING");
    expect(paymentsService.releaseAcceptIntent).toHaveBeenCalledWith("pi_1", AWARD);
  });

  it("leaves it alone when this same offer already won — its first request is capturing it", async () => {
    vi.mocked(listingsDal.getByIdForUpdate).mockResolvedValue(
      listing({ acceptedOfferId: "offer-1" }) as never
    );
    vi.mocked(listingsDal.getById)
      .mockResolvedValueOnce(listing() as never)
      .mockResolvedValue(listing({ acceptedOfferId: "offer-1" }) as never);

    expect(await codeFrom(accept)).toBe("LISTING_ALREADY_AWARDED");
    expect(paymentsService.releaseAcceptIntent).not.toHaveBeenCalled();
  });

  it("reopens the job and releases the card when the capture fails", async () => {
    vi.mocked(paymentsService.chargeForShipment).mockRejectedValue(
      new OfferError("PAYMENT_CHARGE_FAILED", 402)
    );

    expect(await codeFrom(accept)).toBe("PAYMENT_CHARGE_FAILED");
    expect(listingsDal.update).toHaveBeenLastCalledWith(
      "job-1",
      expect.objectContaining({ status: "open", acceptedOfferId: null }),
      expect.anything()
    );
    expect(paymentsService.releaseAcceptIntent).toHaveBeenCalledWith("pi_1", AWARD);
  });

  it("never releases anything for someone who may not award", async () => {
    expect(await codeFrom(() => accept("someone"))).toBe("FORBIDDEN_NOT_SHIPPER");
    expect(paymentsService.releaseAcceptIntent).not.toHaveBeenCalled();
  });

  // A re-accept of an offer that already won. Which intent the award was paid
  // with decides whether the one just sent is spare (§3.4).
  describe("when the offer has already won", () => {
    beforeEach(() => {
      vi.mocked(offersDal.getById).mockResolvedValue(
        offer({ status: "accepted" }) as never
      );
    });

    it("releases a second card authorised after the first accept's answer was lost", async () => {
      vi.mocked(paymentsService.getForShipment).mockResolvedValue({
        stripePaymentIntentId: "pi_first",
      } as never);

      const result = await accept();

      expect(result.alreadyAccepted).toBe(true);
      expect(paymentsService.getForShipment).toHaveBeenCalledWith("ship-1");
      expect(paymentsService.releaseAcceptIntent).toHaveBeenCalledWith("pi_1", AWARD);
    });

    it("leaves the intent the award was paid with alone", async () => {
      vi.mocked(paymentsService.getForShipment).mockResolvedValue({
        stripePaymentIntentId: "pi_1",
      } as never);

      await accept();

      expect(paymentsService.releaseAcceptIntent).not.toHaveBeenCalled();
    });

    it("leaves it alone while no payment is on record — the first request may be capturing it", async () => {
      vi.mocked(paymentsService.getForShipment).mockResolvedValue(undefined as never);

      await accept();

      expect(paymentsService.releaseAcceptIntent).not.toHaveBeenCalled();
    });

    it("still answers when the payment cannot be read", async () => {
      vi.mocked(paymentsService.getForShipment).mockRejectedValue(new Error("db"));

      const result = await accept();

      expect(result.alreadyAccepted).toBe(true);
      expect(paymentsService.releaseAcceptIntent).not.toHaveBeenCalled();
    });

    it("looks nothing up for a re-accept that names no intent", async () => {
      await offersService.acceptOffer("shipper-1", "offer-1");

      expect(paymentsService.getForShipment).not.toHaveBeenCalled();
    });
  });

  it("releases nothing on the older lane, which authorised no card", async () => {
    vi.mocked(paymentsService.chargeForShipment).mockRejectedValue(
      new OfferError("PAYMENT_METHOD_REQUIRED", 402)
    );

    expect(await codeFrom(() => offersService.acceptOffer("shipper-1", "offer-1")))
      .toBe("PAYMENT_METHOD_REQUIRED");
    expect(paymentsService.chargeForShipment).toHaveBeenCalledWith(
      expect.objectContaining({ paymentIntentId: undefined })
    );
    expect(paymentsService.releaseAcceptIntent).not.toHaveBeenCalled();
  });
});
