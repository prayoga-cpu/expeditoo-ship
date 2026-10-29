import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Expeditoo's pick and the negotiation, on the offer itself
 * (client_feedback_2026_10_29_spec.md §B1, §B6).
 */

const m = vi.hoisted(() => ({
  offers: {
    getById: vi.fn(),
    updateNegotiation: vi.fn(),
    clearProposalsForListing: vi.fn(),
  },
  listings: { getById: vi.fn() },
  carriers: { getByUserId: vi.fn() },
  notify: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/db", () => ({
  db: { transaction: async (fn: (tx: unknown) => unknown) => await fn("tx") },
}));
vi.mock("@/server/dal/offers.dal", () => ({ offersDal: m.offers }));
vi.mock("@/server/dal/listings.dal", () => ({ listingsDal: m.listings }));
vi.mock("@/server/dal/carriers.dal", () => ({ carriersDal: m.carriers }));
vi.mock("@/server/dal/users.dal", () => ({ userHasRole: vi.fn() }));
vi.mock("@/server/services/notifications.service", () => ({
  notificationsService: { createNotification: m.notify },
}));
vi.mock("@/server/services/payments.service", () => ({ paymentsService: {} }));
vi.mock("@/server/services/expedion-bridge.service", () => ({
  expedionBridgeService: {},
  notifyExpedion: vi.fn(),
}));

import { MAX_COUNTER_ROUNDS, offersService } from "../offers.service";

const offer = (over: Record<string, unknown> = {}) => ({
  id: "o1",
  listingId: "job-1",
  carrierId: "carrier-1",
  priceCents: 20_000,
  status: "pending",
  counterPriceCents: null,
  counterRounds: 0,
  ...over,
});
const listing = (over: Record<string, unknown> = {}) => ({
  id: "job-1",
  title: "Armoire",
  shipperId: "requester-1",
  origin: "direct",
  status: "open",
  acceptedOfferId: null,
  ...over,
});
const operator = { userId: "op-1", isOperator: true };

beforeEach(() => {
  vi.clearAllMocks();
  m.offers.getById.mockResolvedValue(offer());
  m.listings.getById.mockResolvedValue(listing());
  m.carriers.getByUserId.mockResolvedValue({ status: "approved", absentSince: null });
  m.offers.updateNegotiation.mockImplementation(async (id: string, data: object) => ({
    ...offer(),
    ...data,
    id,
  }));
});

describe("proposeOffer (§B1)", () => {
  it("marks one offer as Expeditoo's pick, clearing any other, and tells the requester", async () => {
    const result = await offersService.proposeOffer(operator, "o1");

    expect(m.offers.clearProposalsForListing).toHaveBeenCalledWith("job-1", "tx");
    expect(m.offers.updateNegotiation).toHaveBeenCalledWith(
      "o1",
      { proposedAt: expect.any(Date), proposedBy: "op-1" },
      "tx"
    );
    expect(m.notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "requester-1", type: "offer_proposed" })
    );
    // Which staff account picked it is the back office's business.
    expect(result).not.toHaveProperty("proposedBy");
  });

  it("is for staff only", async () => {
    await expect(offersService.proposeOffer({ userId: "requester-1" }, "o1")).rejects.toMatchObject({
      code: "FORBIDDEN_NOT_OPERATOR",
    });
  });

  it("is for direct requests only: an operator awards an escalated job outright", async () => {
    m.listings.getById.mockResolvedValue(listing({ origin: "expedion" }));
    await expect(offersService.proposeOffer(operator, "o1")).rejects.toMatchObject({
      code: "PROPOSAL_NOT_AVAILABLE",
    });
  });

  it("refuses an offer from a driver who is away", async () => {
    m.carriers.getByUserId.mockResolvedValue({ status: "approved", absentSince: new Date() });
    await expect(offersService.proposeOffer(operator, "o1")).rejects.toMatchObject({
      code: "CARRIER_ABSENT",
    });
  });

  it.each([
    ["an offer no longer pending", () => m.offers.getById.mockResolvedValue(offer({ status: "withdrawn" })), "OFFER_NOT_PENDING"],
    ["a job already awarded", () => m.listings.getById.mockResolvedValue(listing({ acceptedOfferId: "o2" })), "LISTING_NOT_OPEN"],
  ])("refuses %s", async (_label, arrange, code) => {
    arrange();
    await expect(offersService.proposeOffer(operator, "o1")).rejects.toMatchObject({ code });
  });
});

describe("counterOffer (§B6)", () => {
  const input = { priceCents: 16_000, note: "Mon budget" };

  it("records the requester's price on the offer and tells the carrier", async () => {
    await offersService.counterOffer("requester-1", "o1", input);
    expect(m.offers.updateNegotiation).toHaveBeenCalledWith("o1", {
      counterPriceCents: 16_000,
      counterNote: "Mon budget",
      counteredAt: expect.any(Date),
      counterRounds: 1,
    });
    expect(m.notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "carrier-1", type: "offer_countered" })
    );
  });

  it("is the job's owner's alone", async () => {
    await expect(offersService.counterOffer("someone", "o1", input)).rejects.toMatchObject({
      code: "FORBIDDEN_NOT_SHIPPER",
    });
  });

  it("is refused on an escalated job, whose price was paid in Expedion", async () => {
    m.listings.getById.mockResolvedValue(listing({ origin: "expedion", shipperId: "requester-1" }));
    await expect(offersService.counterOffer("requester-1", "o1", input)).rejects.toMatchObject({
      code: "COUNTER_NOT_AVAILABLE",
    });
  });

  it("waits for an answer before another price", async () => {
    m.offers.getById.mockResolvedValue(offer({ counterPriceCents: 17_000 }));
    await expect(offersService.counterOffer("requester-1", "o1", input)).rejects.toMatchObject({
      code: "COUNTER_PENDING",
    });
  });

  it(`stops after ${MAX_COUNTER_ROUNDS} rounds`, async () => {
    m.offers.getById.mockResolvedValue(offer({ counterRounds: MAX_COUNTER_ROUNDS }));
    await expect(offersService.counterOffer("requester-1", "o1", input)).rejects.toMatchObject({
      code: "COUNTER_LIMIT_REACHED",
    });
  });

  it("refuses the price already on the table", async () => {
    await expect(
      offersService.counterOffer("requester-1", "o1", { priceCents: 20_000, note: null })
    ).rejects.toMatchObject({ code: "COUNTER_SAME_PRICE" });
  });
});

describe("respondToCounter (§B6)", () => {
  beforeEach(() => {
    m.offers.getById.mockResolvedValue(offer({ counterPriceCents: 16_000, counterRounds: 1 }));
  });
  const cleared = { counterPriceCents: null, counterNote: null, counteredAt: null };

  it("accepting makes the client's price the offer's price", async () => {
    await offersService.respondToCounter("carrier-1", "o1", { action: "accept" });
    expect(m.offers.updateNegotiation).toHaveBeenCalledWith("o1", { priceCents: 16_000, ...cleared });
    expect(m.notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "requester-1", type: "offer_counter_answered" })
    );
  });

  it("declining keeps the carrier's price", async () => {
    await offersService.respondToCounter("carrier-1", "o1", { action: "decline" });
    expect(m.offers.updateNegotiation).toHaveBeenCalledWith("o1", { priceCents: 20_000, ...cleared });
  });

  it("revising answers with a new price", async () => {
    await offersService.respondToCounter("carrier-1", "o1", { action: "revise", priceCents: 18_000 });
    expect(m.offers.updateNegotiation).toHaveBeenCalledWith("o1", { priceCents: 18_000, ...cleared });
  });

  it("is the carrier's own offer only", async () => {
    await expect(
      offersService.respondToCounter("carrier-2", "o1", { action: "accept" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("needs a counter-price to answer", async () => {
    m.offers.getById.mockResolvedValue(offer());
    await expect(
      offersService.respondToCounter("carrier-1", "o1", { action: "accept" })
    ).rejects.toMatchObject({ code: "NO_COUNTER_PENDING" });
  });

  it("changes nothing when the award won the race", async () => {
    m.offers.updateNegotiation.mockResolvedValue(undefined);
    await expect(
      offersService.respondToCounter("carrier-1", "o1", { action: "accept" })
    ).rejects.toMatchObject({ code: "OFFER_NOT_PENDING" });
  });
});
