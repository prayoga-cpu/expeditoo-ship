import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  threadOffersService,
  ThreadOfferError,
} from "../thread-offers.service";
import { messagesDAL } from "@/server/dal/messages.dal";
import { threadOffersDal } from "@/server/dal/thread-offers.dal";
import { carriersDal } from "@/server/dal/carriers.dal";
import { offersDal } from "@/server/dal/offers.dal";
import { offersService } from "../offers.service";
import * as userService from "../user.service";
import { publishNewMessage } from "../message-publish";

// Covers docs/specs/thread_offer_spec.md §5, §7 and §12.

vi.mock("@/server/dal/messages.dal", () => ({
  messagesDAL: { getConversationById: vi.fn(), createMessage: vi.fn() },
}));

vi.mock("@/server/dal/thread-offers.dal", () => ({
  threadOffersDal: {
    create: vi.fn(),
    getById: vi.fn(),
    getPendingBySender: vi.fn(),
    updateStatus: vi.fn(),
    linkOffer: vi.fn(),
  },
}));

vi.mock("@/server/dal/carriers.dal", () => ({
  carriersDal: { getByUserId: vi.fn() },
}));

vi.mock("@/server/dal/offers.dal", () => ({
  offersDal: { getLiveByCarrierAndListing: vi.fn() },
}));

// importActual so the real OfferError survives and `instanceof` still holds
// where the service re-throws it untouched.
vi.mock("../offers.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../offers.service")>();
  return {
    ...actual,
    offersService: {
      submitOffer: vi.fn(),
      acceptOffer: vi.fn(),
      withdrawOffer: vi.fn(),
    },
  };
});

vi.mock("../user.service", () => ({ hasRole: vi.fn() }));
vi.mock("../message-publish", () => ({ publishNewMessage: vi.fn() }));

// ========================================
// Fixtures
// ========================================

const ME = "user-me";
const THEM = "user-them";

const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};

const openListing = (overrides: Record<string, unknown> = {}) => ({
  id: "listing-1",
  title: "Paris → Lyon",
  status: "open",
  origin: "direct",
  shipperId: THEM,
  budgetCents: 20000,
  expiresAt: new Date(Date.now() + 86_400_000),
  isFlexible: true,
  weightKg: 50,
  lengthCm: null,
  widthCm: null,
  heightCm: null,
  pickupFrom: new Date(Date.now() + 3_600_000),
  pickupUntil: new Date(Date.now() + 172_800_000),
  ...overrides,
});

const conversation = (overrides: Record<string, unknown> = {}) => ({
  id: "conv-1",
  type: "LISTING",
  listingId: "listing-1",
  listing: openListing(),
  participants: [{ user: { id: ME } }, { user: { id: THEM } }],
  ...overrides,
});

const standaloneConversation = () =>
  conversation({ type: "SUPPORT", listingId: null, listing: null });

const validInput = (overrides: Record<string, unknown> = {}) => ({
  priceCents: 18000,
  pickupDay: tomorrow(),
  pickupSlot: "morning" as const,
  deliveryLeadDays: 0,
  tzOffset: 0,
  vehicleId: "veh-1",
  ...overrides,
});

const codeFrom = async (promise: Promise<unknown>) => {
  try {
    await promise;
    return "NO_ERROR_THROWN";
  } catch (error) {
    return error instanceof Error && "code" in error
      ? (error as ThreadOfferError).code
      : String(error);
  }
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(threadOffersDal.getPendingBySender).mockResolvedValue(undefined);
  vi.mocked(carriersDal.getByUserId).mockResolvedValue({
    id: "carrier-1",
    status: "approved",
  } as never);
  vi.mocked(offersDal.getLiveByCarrierAndListing).mockResolvedValue(undefined);
  vi.mocked(userService.hasRole).mockResolvedValue(false);
  vi.mocked(threadOffersDal.create).mockImplementation(
    async (data) => ({ ...data, status: "pending" }) as never
  );
  vi.mocked(messagesDAL.createMessage).mockResolvedValue({
    id: "msg-1",
    createdAt: new Date(),
  } as never);
});

// ========================================
// contextFor — the standalone lane
// ========================================

describe("contextFor — standalone lane", () => {
  it("lets any participant quote on a thread with no listing", async () => {
    const ctx = await threadOffersService.contextFor(
      ME,
      standaloneConversation() as never
    );

    expect(ctx.lane).toBe("standalone");
    expect(ctx.canOffer).toBe(true);
    expect(ctx.blockedBy).toBeNull();
    expect(ctx.job).toBeNull();
  });

  it("applies no job rules at all — no carrier or offer lookup", async () => {
    await threadOffersService.contextFor(ME, standaloneConversation() as never);

    expect(carriersDal.getByUserId).not.toHaveBeenCalled();
    expect(offersDal.getLiveByCarrierAndListing).not.toHaveBeenCalled();
  });

  it("blocks a second live offer from the same sender", async () => {
    vi.mocked(threadOffersDal.getPendingBySender).mockResolvedValue({
      id: "to-1",
    } as never);

    const ctx = await threadOffersService.contextFor(
      ME,
      standaloneConversation() as never
    );

    expect(ctx.canOffer).toBe(false);
    expect(ctx.blockedBy).toBe("OFFER_LIVE");
  });
});

// ========================================
// contextFor — the job lane
// ========================================

describe("contextFor — job lane", () => {
  it("allows an approved carrier with no live bid", async () => {
    const ctx = await threadOffersService.contextFor(
      ME,
      conversation() as never
    );

    expect(ctx.lane).toBe("job");
    expect(ctx.canOffer).toBe(true);
    expect(ctx.job).toMatchObject({ id: "listing-1", budgetCents: 20000 });
  });

  it.each([
    ["awarded", { status: "awarded" }, "LISTING_NOT_OPEN"],
    ["expired", { expiresAt: new Date(Date.now() - 1000) }, "LISTING_EXPIRED"],
    ["owned by the viewer", { shipperId: ME }, "OWN_LISTING"],
  ])("blocks a listing %s", async (_label, overrides, expected) => {
    const ctx = await threadOffersService.contextFor(
      ME,
      conversation({ listing: openListing(overrides) }) as never
    );

    expect(ctx.canOffer).toBe(false);
    expect(ctx.blockedBy).toBe(expected);
  });

  it("blocks someone with no carrier row — this is how a driver is excluded", async () => {
    vi.mocked(carriersDal.getByUserId).mockResolvedValue(undefined as never);

    const ctx = await threadOffersService.contextFor(
      ME,
      conversation() as never
    );

    expect(ctx.blockedBy).toBe("NOT_A_CARRIER");
  });

  it("blocks a suspended carrier, who still holds the role", async () => {
    vi.mocked(carriersDal.getByUserId).mockResolvedValue({
      id: "carrier-1",
      status: "suspended",
    } as never);

    const ctx = await threadOffersService.contextFor(
      ME,
      conversation() as never
    );

    expect(ctx.blockedBy).toBe("NOT_APPROVED");
  });

  it("names a live bid, and keeps the job so the notice can point at it", async () => {
    vi.mocked(offersDal.getLiveByCarrierAndListing).mockResolvedValue({
      id: "offer-1",
      status: "pending",
    } as never);

    const ctx = await threadOffersService.contextFor(
      ME,
      conversation() as never
    );

    expect(ctx.blockedBy).toBe("OFFER_LIVE");
    expect(ctx.job).not.toBeNull();
  });

  it.each(["rejected", "expired", "accepted"])(
    "reports a burnt slot for a %s offer",
    async (status) => {
      vi.mocked(offersDal.getLiveByCarrierAndListing).mockResolvedValue({
        id: "offer-1",
        status,
      } as never);

      const ctx = await threadOffersService.contextFor(
        ME,
        conversation() as never
      );

      expect(ctx.blockedBy).toBe("OFFER_SLOT_BURNT");
    }
  );
});

// ========================================
// viewerCanAward
// ========================================

describe("viewerCanAward", () => {
  it("is true for the job's owner on a direct listing", async () => {
    const ctx = await threadOffersService.contextFor(
      THEM,
      conversation() as never
    );

    expect(ctx.viewerCanAward).toBe(true);
  });

  it("costs no role query at all on a direct listing", async () => {
    await threadOffersService.contextFor(ME, conversation() as never);

    expect(userService.hasRole).not.toHaveBeenCalled();
  });

  it("is true for an operator on an escalated listing", async () => {
    vi.mocked(userService.hasRole).mockImplementation(
      async (_id, role) => role === "operator"
    );

    const ctx = await threadOffersService.contextFor(
      ME,
      conversation({ listing: openListing({ origin: "expedion" }) }) as never
    );

    expect(ctx.viewerCanAward).toBe(true);
  });

  it("is false for a random participant on an escalated listing", async () => {
    const ctx = await threadOffersService.contextFor(
      ME,
      conversation({ listing: openListing({ origin: "expedion" }) }) as never
    );

    expect(ctx.viewerCanAward).toBe(false);
  });
});

// ========================================
// submit
// ========================================

describe("submit", () => {
  beforeEach(() => {
    vi.mocked(messagesDAL.getConversationById).mockResolvedValue(
      conversation() as never
    );
    vi.mocked(offersService.submitOffer).mockResolvedValue({
      id: "offer-1",
    } as never);
  });

  it("hides a missing conversation and a non-participant behind one code", async () => {
    vi.mocked(messagesDAL.getConversationById).mockResolvedValueOnce(
      undefined as never
    );
    const missing = await codeFrom(
      threadOffersService.submit(ME, "conv-x", validInput() as never)
    );

    vi.mocked(messagesDAL.getConversationById).mockResolvedValueOnce(
      conversation({
        participants: [{ user: { id: "someone" } }],
      }) as never
    );
    const outsider = await codeFrom(
      threadOffersService.submit(ME, "conv-1", validInput() as never)
    );

    expect(missing).toBe("CONVERSATION_NOT_FOUND");
    expect(outsider).toBe("CONVERSATION_NOT_FOUND");
  });

  it("takes the listing from the conversation, never from the body", async () => {
    await threadOffersService.submit(
      ME,
      "conv-1",
      validInput({ listingId: "attacker-listing" }) as never
    );

    expect(offersService.submitOffer).toHaveBeenCalledWith(
      ME,
      "listing-1",
      expect.anything()
    );
  });

  it("bids exactly one slot, which is what makes in-chat accept safe", async () => {
    const day = tomorrow();
    await threadOffersService.submit(
      ME,
      "conv-1",
      validInput({ pickupDay: day, pickupSlot: "afternoon" }) as never
    );

    expect(offersService.submitOffer).toHaveBeenCalledWith(
      ME,
      "listing-1",
      expect.objectContaining({ slots: [{ day, slot: "afternoon" }] })
    );
  });

  it("writes one message carrying the offer id", async () => {
    await threadOffersService.submit(ME, "conv-1", validInput() as never);

    expect(messagesDAL.createMessage).toHaveBeenCalledTimes(1);
    expect(messagesDAL.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({ threadOfferId: expect.any(String) })
    );
  });

  it("stores the sender's own words as the message content", async () => {
    await threadOffersService.submit(
      ME,
      "conv-1",
      validInput({ message: "Je peux le faire demain" }) as never
    );

    expect(messagesDAL.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({ content: "Je peux le faire demain" })
    );
  });

  it("falls back to a human summary, never JSON", async () => {
    await threadOffersService.submit(ME, "conv-1", validInput() as never);

    const content = vi.mocked(messagesDAL.createMessage).mock.calls[0][0]
      .content as string;
    expect(content).not.toContain("{");
    expect(content).toContain("180");
  });

  it("passes an offers-engine error through with its code intact", async () => {
    const { OfferError } = await import("../offers.service");
    vi.mocked(offersService.submitOffer).mockRejectedValue(
      new OfferError("CARRIER_NOT_APPROVED", 403)
    );

    const code = await codeFrom(
      threadOffersService.submit(ME, "conv-1", validInput() as never)
    );

    expect(code).toBe("CARRIER_NOT_APPROVED");
  });

  it("refuses a second live offer in the same thread", async () => {
    vi.mocked(threadOffersDal.getPendingBySender).mockResolvedValue({
      id: "to-1",
    } as never);

    const code = await codeFrom(
      threadOffersService.submit(ME, "conv-1", validInput() as never)
    );

    expect(code).toBe("THREAD_OFFER_LIVE");
  });

  it("never touches the offers engine on the standalone lane", async () => {
    vi.mocked(messagesDAL.getConversationById).mockResolvedValue(
      standaloneConversation() as never
    );

    await threadOffersService.submit(ME, "conv-1", validInput() as never);

    expect(offersService.submitOffer).not.toHaveBeenCalled();
    expect(threadOffersDal.create).toHaveBeenCalledWith(
      expect.objectContaining({ offerId: null })
    );
  });

  it("tells the other side an offer arrived, not just a message", async () => {
    await threadOffersService.submit(ME, "conv-1", validInput() as never);

    expect(publishNewMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: THEM,
        threadOfferId: expect.any(String),
      })
    );
  });
});

// ========================================
// accept / decline / withdraw
// ========================================

describe("responding", () => {
  const pending = (overrides: Record<string, unknown> = {}) => ({
    id: "to-1",
    conversationId: "conv-1",
    senderId: THEM,
    status: "pending",
    offerId: "offer-1",
    ...overrides,
  });

  beforeEach(() => {
    vi.mocked(messagesDAL.getConversationById).mockResolvedValue(
      conversation() as never
    );
    vi.mocked(threadOffersDal.getById).mockResolvedValue(pending() as never);
    vi.mocked(threadOffersDal.updateStatus).mockImplementation(
      async (_id, status) => ({ id: "to-1", status }) as never
    );
    vi.mocked(offersService.acceptOffer).mockResolvedValue({
      shipment: { id: "ship-1" },
    } as never);
  });

  it("refuses to let the sender accept their own offer", async () => {
    vi.mocked(threadOffersDal.getById).mockResolvedValue(
      pending({ senderId: ME }) as never
    );

    expect(await codeFrom(threadOffersService.accept(ME, "to-1"))).toBe(
      "NOT_YOUR_OFFER"
    );
  });

  it("refuses an offer that has already been answered", async () => {
    vi.mocked(threadOffersDal.getById).mockResolvedValue(
      pending({ status: "withdrawn" }) as never
    );

    expect(await codeFrom(threadOffersService.accept(ME, "to-1"))).toBe(
      "OFFER_NOT_PENDING"
    );
  });

  it("awards through the offers engine without naming a slot", async () => {
    const result = await threadOffersService.accept(ME, "to-1");

    expect(offersService.acceptOffer).toHaveBeenCalledWith(ME, "offer-1");
    expect(result.shipmentId).toBe("ship-1");
  });

  it("moves no money on the standalone lane", async () => {
    vi.mocked(threadOffersDal.getById).mockResolvedValue(
      pending({ offerId: null }) as never
    );

    const result = await threadOffersService.accept(ME, "to-1");

    expect(offersService.acceptOffer).not.toHaveBeenCalled();
    expect(result.shipmentId).toBeNull();
  });

  it("declines without rejecting the underlying bid", async () => {
    await threadOffersService.decline(ME, "to-1");

    expect(offersService.acceptOffer).not.toHaveBeenCalled();
    expect(threadOffersDal.updateStatus).toHaveBeenCalledWith(
      "to-1",
      "declined",
      ME
    );
  });

  it("lets only the sender withdraw", async () => {
    expect(await codeFrom(threadOffersService.withdraw(ME, "to-1"))).toBe(
      "NOT_YOUR_OFFER_TO_WITHDRAW"
    );
  });

  it("withdraws the real bid alongside the card", async () => {
    vi.mocked(threadOffersDal.getById).mockResolvedValue(
      pending({ senderId: ME }) as never
    );

    await threadOffersService.withdraw(ME, "to-1");

    expect(offersService.withdrawOffer).toHaveBeenCalledWith(ME, "offer-1");
    expect(threadOffersDal.updateStatus).toHaveBeenCalledWith(
      "to-1",
      "withdrawn",
      null
    );
  });
});
