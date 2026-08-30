import { nanoid } from "nanoid";

import { messagesDAL } from "@/server/dal/messages.dal";
import { threadOffersDal } from "@/server/dal/thread-offers.dal";
import { carriersDal } from "@/server/dal/carriers.dal";
import { offersDal } from "@/server/dal/offers.dal";
import { offersService } from "./offers.service";
import * as userService from "./user.service";
import { publishNewMessage } from "./message-publish";
import { resolveOfferSlots } from "@/lib/offer-slots";
import { formatCurrency } from "@/lib/currency";
import type { CreateThreadOfferInput } from "@/server/dto/thread-offers.dto";

// ========================================
// Errors
// ========================================

export class ThreadOfferError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message?: string
  ) {
    super(message ?? code);
    this.name = "ThreadOfferError";
  }
}

const err = (code: string, status: number) => new ThreadOfferError(code, status);

// ========================================
// Context
// ========================================

export type ThreadOfferBlock =
  | "NOT_A_CARRIER"
  | "NOT_APPROVED"
  | "OWN_LISTING"
  | "LISTING_NOT_OPEN"
  | "LISTING_EXPIRED"
  | "OFFER_LIVE"
  | "OFFER_SLOT_BURNT";

export interface ThreadOfferJob {
  id: string;
  title: string;
  budgetCents: number;
  weightKg: number;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  pickupFrom: string;
  pickupUntil: string;
  isFlexible: boolean;
}

export interface ThreadOfferContext {
  lane: "job" | "standalone";
  canOffer: boolean;
  blockedBy: ThreadOfferBlock | null;
  job: ThreadOfferJob | null;
  viewerCanAward: boolean;
}

type ConversationRow = NonNullable<
  Awaited<ReturnType<typeof messagesDAL.getConversationById>>
>;

const blocked = (
  lane: "job" | "standalone",
  blockedBy: ThreadOfferBlock,
  job: ThreadOfferJob | null = null
): ThreadOfferContext => ({
  lane,
  canOffer: false,
  blockedBy,
  job,
  viewerCanAward: false,
});

// ========================================
// Service
// ========================================

export const threadOffersService = {
  /**
   * Whether this viewer may put a price on the table in this thread, and why
   * not when they may not.
   *
   * The whole visibility decision lives here so no client re-derives a
   * permission: the trigger is correct in `/messages`, `/driver/messages` and
   * `/admin/support` with no per-shell wiring. See thread_offer_spec.md §7.
   */
  async contextFor(
    userId: string,
    conversation: ConversationRow
  ): Promise<ThreadOfferContext> {
    const listing = conversation.listing;

    // The standalone lane: no job to bid on, so no job rules to apply. Any
    // participant may quote, because without a listing the app cannot know
    // which side is the transporter, and refusing everyone would make the
    // control absent on exactly the threads it was asked for (spec §5.2).
    if (conversation.type !== "LISTING" || !listing) {
      const live = await threadOffersDal.getPendingBySender(
        conversation.id,
        userId
      );
      return {
        lane: "standalone",
        canOffer: !live,
        blockedBy: live ? "OFFER_LIVE" : null,
        job: null,
        viewerCanAward: false,
      };
    }

    const viewerCanAward = await canAward(userId, listing);
    const job = toJob(listing);

    // Being unable to *send* an offer says nothing about being able to *answer*
    // one, and the two most common recipients - the job's owner and an operator
    // - are blocked senders by definition. So every branch below carries
    // `viewerCanAward` rather than defaulting it to false, or the Accept button
    // would never render for the very people who award.
    const no = (blockedBy: ThreadOfferBlock, withJob = false) => ({
      ...blocked("job", blockedBy, withJob ? job : null),
      viewerCanAward,
    });

    if (listing.status !== "open") return no("LISTING_NOT_OPEN");
    if (listing.expiresAt && new Date(listing.expiresAt) <= new Date()) {
      return no("LISTING_EXPIRED");
    }
    if (listing.shipperId === userId) return no("OWN_LISTING");

    const carrier = await carriersDal.getByUserId(userId);
    if (!carrier) return no("NOT_A_CARRIER");
    // `suspended` still holds the `carrier` role, so a role-only gate would
    // have offered a suspended carrier a form they can only fail.
    if (carrier.status !== "approved") return no("NOT_APPROVED");

    // The carrier's one slot on this listing may already be spent - from this
    // thread or from the job page; the two surfaces share it.
    const existing = await offersDal.getLiveByCarrierAndListing(
      listing.id,
      userId
    );
    if (existing) {
      return existing.status === "pending"
        ? no("OFFER_LIVE", true)
        : no("OFFER_SLOT_BURNT", true);
    }

    return {
      lane: "job",
      canOffer: true,
      blockedBy: null,
      job,
      viewerCanAward,
    };
  },

  /**
   * Put a price on the table.
   *
   * On the job lane this creates a real `offers` row first, so the chat feeds
   * the existing reverse auction instead of shadowing it, and every rule the
   * auction enforces - approval, vehicle capacity, pickup window - applies
   * unchanged. Its errors pass through unwrapped so their codes survive.
   */
  async submit(
    userId: string,
    conversationId: string,
    input: CreateThreadOfferInput,
    senderInfo?: { name: string; image: string | null }
  ) {
    const conversation = await requireParticipant(conversationId, userId);

    const live = await threadOffersDal.getPendingBySender(
      conversationId,
      userId
    );
    if (live) throw err("THREAD_OFFER_LIVE", 409);

    const [resolved] = resolveOfferSlots(
      [{ day: input.pickupDay, slot: input.pickupSlot }],
      input.deliveryLeadDays,
      input.tzOffset
    );

    // The listing comes from the conversation, never from the body - the same
    // reasoning that keeps `origin` off createListingSchema.
    const listingId =
      conversation.type === "LISTING" ? conversation.listingId : null;

    // The bid is minted before the card, deliberately. The two writes are not
    // one transaction - `submitOffer` runs its own - so one of them can land
    // alone, and this is the order whose failure is survivable: a bid with no
    // chat card is still visible at /carrier/offers and still awardable, while
    // a card with no bid would promise an award that cannot happen.
    let offerId: string | null = null;
    if (listingId) {
      const offer = await offersService.submitOffer(userId, listingId, {
        vehicleId: input.vehicleId ?? "",
        priceCents: input.priceCents,
        slots: [{ day: input.pickupDay, slot: input.pickupSlot }],
        deliveryLeadDays: input.deliveryLeadDays,
        tzOffset: input.tzOffset,
        message: input.message,
      });
      offerId = offer.id;
    }

    const threadOffer = await threadOffersDal.create({
      id: nanoid(),
      conversationId,
      senderId: userId,
      priceCents: input.priceCents,
      pickupDay: input.pickupDay,
      pickupSlot: input.pickupSlot,
      deliveryLeadDays: input.deliveryLeadDays,
      tzOffset: input.tzOffset,
      pickupAt: resolved.startsAt,
      deliveryAt: resolved.deliveryAt,
      note: input.message ?? null,
      vehicleId: input.vehicleId ?? null,
      offerId,
    });

    // The stored text is the sender's own words, or a short human summary.
    // Never JSON: the inbox snippet, the admin support list and the Expedion
    // Flutter client all print `content` verbatim.
    const content = input.message?.trim() || summarise(input);

    const message = await messagesDAL.createMessage({
      id: nanoid(),
      conversationId,
      senderId: userId,
      content,
      threadOfferId: threadOffer.id,
    });

    publishNewMessage({
      conversationId,
      senderId: userId,
      recipientId: otherParticipant(conversation, userId),
      message,
      content,
      senderInfo,
      threadOfferId: threadOffer.id,
    });

    return { threadOffer, message };
  },

  /**
   * Say yes, from inside the chat.
   *
   * On the job lane this is the one money path: `offersService.acceptOffer`
   * commits the award, the shipment and the payment hold. No `slotId` is
   * passed because a chat offer carries exactly one slot, so there is nothing
   * to choose between and nothing to get wrong (spec §1.2).
   */
  async accept(userId: string, threadOfferId: string) {
    const { threadOffer } = await requireRespondable(userId, threadOfferId);

    let shipmentId: string | null = null;
    if (threadOffer.offerId) {
      const result = await offersService.acceptOffer(
        userId,
        threadOffer.offerId
      );
      shipmentId = result?.shipment?.id ?? null;
    }

    const updated = await threadOffersDal.updateStatus(
      threadOffer.id,
      "accepted",
      userId
    );
    return { threadOffer: updated, shipmentId };
  },

  async decline(userId: string, threadOfferId: string) {
    const { threadOffer } = await requireRespondable(userId, threadOfferId);
    // Declining does not reject the underlying bid: on the job lane an
    // operator may still award it from /admin/awards, and one person's "no
    // thanks" in a chat is not that decision.
    const updated = await threadOffersDal.updateStatus(
      threadOffer.id,
      "declined",
      userId
    );
    return { threadOffer: updated };
  },

  /** The sender retracts. On the job lane the bid goes with it. */
  async withdraw(userId: string, threadOfferId: string) {
    const threadOffer = await threadOffersDal.getById(threadOfferId);
    if (!threadOffer) throw err("THREAD_OFFER_NOT_FOUND", 404);
    await requireParticipant(threadOffer.conversationId, userId);

    if (threadOffer.senderId !== userId) {
      throw err("NOT_YOUR_OFFER_TO_WITHDRAW", 403);
    }
    if (threadOffer.status !== "pending") throw err("OFFER_NOT_PENDING", 409);

    if (threadOffer.offerId) {
      await offersService.withdrawOffer(userId, threadOffer.offerId);
    }

    const updated = await threadOffersDal.updateStatus(
      threadOffer.id,
      "withdrawn",
      null
    );
    return { threadOffer: updated };
  },
};

// ========================================
// Helpers
// ========================================

/**
 * 404 rather than 403 for a non-participant, so conversation ids are not
 * probeable - the carrier_trips_spec.md §5 convention.
 */
async function requireParticipant(conversationId: string, userId: string) {
  const conversation = await messagesDAL.getConversationById(conversationId);
  if (!conversation) throw err("CONVERSATION_NOT_FOUND", 404);
  if (!conversation.participants.some((p) => p.user.id === userId)) {
    throw err("CONVERSATION_NOT_FOUND", 404);
  }
  return conversation;
}

/** Shared gate for accept and decline: a participant, but not the sender. */
async function requireRespondable(userId: string, threadOfferId: string) {
  const threadOffer = await threadOffersDal.getById(threadOfferId);
  if (!threadOffer) throw err("THREAD_OFFER_NOT_FOUND", 404);

  const conversation = await requireParticipant(
    threadOffer.conversationId,
    userId
  );

  if (threadOffer.senderId === userId) throw err("NOT_YOUR_OFFER", 403);
  if (threadOffer.status !== "pending") throw err("OFFER_NOT_PENDING", 409);

  return { threadOffer, conversation };
}

const otherParticipant = (conversation: ConversationRow, userId: string) =>
  conversation.participants.find((p) => p.user.id !== userId)?.user.id ?? null;

/**
 * Whether this viewer is the one who awards this job - mirroring
 * `acceptOffer`'s own origin fork rather than restating a role list.
 *
 * The two role lookups run only for an escalated job the viewer does not own,
 * so a direct thread costs no extra query.
 */
async function canAward(
  userId: string,
  listing: { status: string; shipperId: string; origin: string | null }
) {
  if (listing.status !== "open") return false;
  if (listing.shipperId === userId) return true;
  if (listing.origin !== "expedion") return false;
  return (
    (await userService.hasRole(userId, "operator")) ||
    (await userService.hasRole(userId, "admin"))
  );
}

function toJob(listing: ConversationRow["listing"]): ThreadOfferJob {
  const row = listing!;
  return {
    id: row.id,
    title: row.title,
    budgetCents: row.budgetCents,
    weightKg: row.weightKg,
    lengthCm: row.lengthCm,
    widthCm: row.widthCm,
    heightCm: row.heightCm,
    pickupFrom: new Date(row.pickupFrom).toISOString(),
    pickupUntil: new Date(row.pickupUntil).toISOString(),
    isFlexible: row.isFlexible,
  };
}

/** A locale-neutral one-liner for the inbox snippet, never for the card. */
const summarise = (input: CreateThreadOfferInput) =>
  `${formatCurrency(input.priceCents)} · ${input.pickupDay}`;
