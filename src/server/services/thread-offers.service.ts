import { nanoid } from "nanoid";
import { mayTakeWork } from "@/lib/carrier-availability";

import { messagesDAL } from "@/server/dal/messages.dal";
import { threadOffersDal } from "@/server/dal/thread-offers.dal";
import { carriersDal } from "@/server/dal/carriers.dal";
import { offersDal } from "@/server/dal/offers.dal";
import { listingsDal } from "@/server/dal/listings.dal";
import { offersService } from "./offers.service";
import { paymentsService } from "./payments.service";
import * as userService from "./user.service";
import { notificationsService } from "./notifications.service";
import { publishNewMessage } from "./message-publish";
import { requesterAlertsService } from "./requester-alerts.service";
import { resolveOfferSlots } from "@/lib/offer-slots";
import { formatCurrency } from "@/lib/currency";
import { ablyServer } from "@/lib/ably-server";
import { namespaced } from "@/lib/env";
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

/** An in-house Expeditop driver (`carriers.kind = 'private'`). */
async function isInHouse(userId: string): Promise<boolean> {
  return (await carriersDal.getByUserId(userId))?.kind === "private";
}

// ========================================
// Context
// ========================================

export type ThreadOfferBlock =
  | "NOT_A_CARRIER"
  | "NOT_APPROVED"
  | "IN_HOUSE_DRIVER"
  | "CARRIER_ABSENT"
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
  /**
   * Whether this viewer may answer a bid with a counter-price on the job page
   * - the requester, on a direct request still open (§13). Decided here so the
   * declined card does not restate the job page's rule.
   */
  canCounter: boolean;
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
  canCounter: false,
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
        canCounter: false,
      };
    }

    const viewerCanAward = await canAward(userId, listing);
    const canCounter = canCounterOn(userId, listing);
    const job = toJob(listing);

    // Being unable to *send* an offer says nothing about being able to *answer*
    // one, and the two most common recipients - the job's owner and an operator
    // - are blocked senders by definition. So every branch below carries
    // `viewerCanAward` rather than defaulting it to false, or the Accept button
    // would never render for the very people who award.
    const no = (blockedBy: ThreadOfferBlock, withJob = false) => ({
      ...blocked("job", blockedBy, withJob ? job : null),
      viewerCanAward,
      canCounter,
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
    // Given work, never bids: the same rule `takeJob` states, for the chat lane.
    if (carrier.kind === "private") return no("IN_HOUSE_DRIVER");
    if (!mayTakeWork(carrier)) return no("CARRIER_ABSENT");

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
      canCounter,
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
      // The context hides the button from an in-house driver; this refuses a
      // request that did not come through it. Job lane only: the standalone
      // quote creates no bid and moves no money, and applies no job rule (§5.2).
      if (await isInHouse(userId)) throw err("IN_HOUSE_DIRECT_ASSIGN_ONLY", 403);
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

    // A quote typed in the chat is a message to the requester too — as is the
    // one sent from the job page, alerted in `announceBid` below.
    void requesterAlertsService
      .onDriverMessage({
        conversationId,
        senderId: userId,
        recipientId: otherParticipant(conversation, userId),
        sentAt: message.createdAt ? new Date(message.createdAt) : new Date(),
      })
      .catch((e) => console.error("requester message alert failed", e));

    return { threadOffer, message };
  },

  /**
   * A bid sent from the job page also appears in the conversation with the
   * requester (client feedback 2026-11-12: « the price proposal is not
   * displayed in the messages »).
   *
   * Until now only a quote typed in the chat made a card; a quote sent from the
   * offer form made a bid and a notification and nothing in Messages, so the
   * two people who had just exchanged a price had no thread to talk about it
   * in. The card is the same one the chat makes — a `thread_offers` row pointing
   * at the real bid, read from the bid at render time — so awarding at the job
   * page, here or at /admin/awards flips it for free.
   *
   * Best-effort, and called by the route rather than by `submitOffer`: the bid
   * is the fact and the card is its mirror, so a failure here must never undo
   * or refuse a bid that already committed (the same order `submit` keeps).
   *
   * Not for an escalated job: its owner is a system account nobody reads, and an
   * operator awards from /admin/awards. Not when this sender already has a live
   * card in the thread. The card carries the **earliest** slot; a bid with
   * several slots says so, and its requester picks one on the job page instead
   * of accepting blind in the bubble.
   */
  async announceBid(
    userId: string,
    offer: { id: string; listingId: string; priceCents: number; vehicleId: string | null; message: string | null },
    input: { slots: { day: string; slot: "morning" | "afternoon" | "evening" }[]; deliveryLeadDays: number; tzOffset: number },
    senderInfo?: { name: string; image: string | null }
  ) {
    const listing = await listingsDal.getById(offer.listingId);
    if (!listing || listing.origin === "expedion" || listing.shipperId === userId) return null;

    const existing = await messagesDAL.findConversation(userId, listing.shipperId, listing.id);
    const conversationId =
      existing?.id ??
      (
        await messagesDAL.createConversation({ id: nanoid(), listingId: listing.id }, [
          userId,
          listing.shipperId,
        ])
      ).id;

    if (await threadOffersDal.getPendingBySender(conversationId, userId)) return null;

    const [first] = resolveOfferSlots(input.slots, input.deliveryLeadDays, input.tzOffset);
    if (!first) return null;

    const threadOffer = await threadOffersDal.create({
      id: nanoid(),
      conversationId,
      senderId: userId,
      priceCents: offer.priceCents,
      pickupDay: first.day,
      pickupSlot: first.slot,
      deliveryLeadDays: input.deliveryLeadDays,
      tzOffset: input.tzOffset,
      pickupAt: first.startsAt,
      deliveryAt: first.deliveryAt,
      note: offer.message ?? null,
      vehicleId: offer.vehicleId,
      offerId: offer.id,
    });

    const content =
      offer.message?.trim() || `${formatCurrency(offer.priceCents)} · ${dayLabel(first.day)}`;
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
      recipientId: listing.shipperId,
      message,
      content,
      senderInfo,
      threadOfferId: threadOffer.id,
    });

    // The requester's only other signal for this bid is the in-app
    // « offer received » bell, which nobody reads with the app closed. The card
    // above is a message from the driver, so it is mailed like one.
    void requesterAlertsService
      .onDriverMessage({
        conversationId,
        senderId: userId,
        recipientId: listing.shipperId,
        sentAt: message.createdAt ? new Date(message.createdAt) : new Date(),
      })
      .catch((e) => console.error("requester message alert failed", e));

    return { threadOffer, message };
  },

  /**
   * Say yes, from inside the chat.
   *
   * On the job lane this is the one money path: `offersService.acceptOffer`
   * commits the award, the shipment and the charge. No `slotId` is passed
   * because a chat offer carries exactly one slot, so there is nothing to
   * choose between and nothing to get wrong (spec §1.2). `paymentIntentId` is
   * the card the requester authorised in the payment dialog, exactly as on the
   * job page (pay_at_accept_spec.md §2).
   */
  async accept(
    userId: string,
    threadOfferId: string,
    opts: { paymentIntentId?: string } = {}
  ) {
    const { threadOffer } = await requireRespondable(
      userId,
      threadOfferId
    ).catch(async (cause) => {
      await releaseRefusedIntent(userId, threadOfferId, opts.paymentIntentId);
      throw cause;
    });

    let shipmentId: string | null = null;
    if (threadOffer.offerId) {
      const result = await offersService.acceptOffer(
        userId,
        threadOffer.offerId,
        { paymentIntentId: opts.paymentIntentId }
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

  /**
   * Say no, from inside the chat - and tell the sender (§13).
   *
   * `notify: false` is for an admin's borrowed session: the decline is
   * recorded as the user's, but nobody is pinged by someone looking.
   */
  async decline(
    userId: string,
    threadOfferId: string,
    { notify = true }: { notify?: boolean } = {}
  ) {
    const { threadOffer, conversation } = await requireRespondable(
      userId,
      threadOfferId
    );
    // Declining does not reject the underlying bid: on the job lane an
    // operator may still award it from /admin/awards, and one person's "no
    // thanks" in a chat is not that decision.
    const updated = await threadOffersDal.updateStatus(
      threadOffer.id,
      "declined",
      userId
    );
    if (notify) await announceDecline(threadOffer, conversation);
    return { threadOffer: updated };
  },

  /**
   * The sender retracts. On the job lane the bid goes with it.
   *
   * A card the other side declined is still the sender's to retract while its
   * bid is live: the bid holds their one slot on the job, and taking it back
   * is how they make room for another price (§13).
   */
  async withdraw(userId: string, threadOfferId: string) {
    const threadOffer = await threadOffersDal.getById(threadOfferId);
    if (!threadOffer) throw err("THREAD_OFFER_NOT_FOUND", 404);
    await requireParticipant(threadOffer.conversationId, userId);

    if (threadOffer.senderId !== userId) {
      throw err("NOT_YOUR_OFFER_TO_WITHDRAW", 403);
    }
    const declinedWithLiveBid =
      threadOffer.status === "declined" &&
      threadOffer.offer?.status === "pending";
    if (threadOffer.status !== "pending" && !declinedWithLiveBid) {
      throw err("OFFER_NOT_PENDING", 409);
    }

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

/**
 * Hands back the card a recipient authorised for an offer this thread then
 * would not let them accept (pay_at_accept_spec.md §3.4).
 *
 * The payment dialog authorises against the *bid*, and on the job lane the bid
 * stays pending after the thread offer was declined. So the refusal below
 * comes after the hold exists and before `acceptOffer`, where every other
 * release lives, and without this the hold sat on the card for a week.
 *
 * `releaseAcceptIntent` only cancels an intent minted for this bid by this
 * user and still unused, so naming someone else's does nothing.
 */
async function releaseRefusedIntent(
  userId: string,
  threadOfferId: string,
  paymentIntentId: string | undefined
) {
  if (!paymentIntentId) return;

  const threadOffer = await threadOffersDal
    .getById(threadOfferId)
    .catch(() => null);
  if (!threadOffer?.offerId) return;

  await paymentsService.releaseAcceptIntent(paymentIntentId, {
    offerId: threadOffer.offerId,
    shipperId: userId,
  });
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

/**
 * The job page's own rule for the counter-price (`counterOffer`): the
 * requester, on a direct request that is still open.
 */
const canCounterOn = (
  userId: string,
  listing: { status: string; shipperId: string; origin: string | null }
) =>
  listing.shipperId === userId &&
  listing.origin === "direct" &&
  listing.status === "open";

/**
 * Tell the sender their price was refused: a notification that opens the
 * thread, and a nudge on the conversation channel so a thread already on
 * screen redraws the card. No chat message is written - the decline is an
 * answer on the card, not words in the recipient's mouth.
 *
 * Best-effort on both halves: the decline has already committed.
 */
async function announceDecline(
  threadOffer: {
    id: string;
    senderId: string;
    conversationId: string;
    priceCents: number;
    offerId: string | null;
  },
  conversation: ConversationRow
) {
  const price = formatCurrency(threadOffer.priceCents);
  const title = conversation.listing?.title;
  const onJob = Boolean(threadOffer.offerId && title);

  await Promise.all([
    notificationsService
      .createNotification({
        userId: threadOffer.senderId,
        type: "offer_declined",
        title: "Votre prix a été refusé",
        message: onJob
          ? `Le demandeur a refusé ${price} pour « ${title} ». Retirez cette offre pour proposer un autre prix.`
          : `Votre offre de ${price} a été refusée. Vous pouvez en envoyer une nouvelle.`,
        linkUrl: `/messages/${threadOffer.conversationId}`,
        data: {
          conversationId: threadOffer.conversationId,
          threadOfferId: threadOffer.id,
          listingId: conversation.listing?.id ?? null,
          offerId: threadOffer.offerId,
        },
      })
      .catch((e) => console.error("offer_declined notification failed", e)),
    ablyServer
      .publish(
        namespaced(`conversation:${threadOffer.conversationId}`),
        "offer:updated",
        { threadOfferId: threadOffer.id, status: "declined" }
      )
      .catch((e) => console.error("offer:updated publish failed", e)),
  ]);
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

const DAY_LABEL = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/**
 * « 27 nov. » for a slot's `YYYY-MM-DD`. The day is already the sender's own
 * calendar day, so it is read at UTC midnight and printed in UTC: converting
 * it to a zone could only move it. A malformed day is printed as it came.
 */
function dayLabel(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? day : DAY_LABEL.format(date);
}

/**
 * A one-liner for the inbox snippet, never for the card. French, like every
 * other text the server writes for a person: no account stores a locale.
 */
const summarise = (input: CreateThreadOfferInput) =>
  `${formatCurrency(input.priceCents)} · ${dayLabel(input.pickupDay)}`;
