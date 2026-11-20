import { and, count, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema/users";
import { listings } from "@/db/schema/listings";
import { offers } from "@/db/schema/offers";
import {
  conversationParticipants,
  conversations,
  messages,
} from "@/db/schema/messages";
import { threadOffers } from "@/db/schema/thread-offers";

// ========================================
// A user's requests, offers and conversations — read only
// docs/specs/admin_user_management_spec.md §7
// ========================================
//
// Every function here is a SELECT. Nothing in this file may insert, update or
// delete: staff reading a thread is not a participant reading it, so no read
// receipt, no `last_read_at`, no unread counter moves. Columns are named one
// by one — no relation graph, no `user: true` join.

interface Paging {
  limit: number;
  offset: number;
}

const jobColumns = {
  id: listings.id,
  reference: listings.reference,
  title: listings.title,
  pickupCity: listings.pickupCity,
  dropoffCity: listings.dropoffCity,
  status: listings.status,
};

/** The conversations this account sits in, including ones it hid from itself. */
const conversationIdsOf = (userId: string) =>
  db
    .select({ id: conversationParticipants.conversationId })
    .from(conversationParticipants)
    .where(eq(conversationParticipants.userId, userId));

const lastActivity = sql`coalesce(${conversations.lastMessageAt}, ${conversations.createdAt})`;

async function total(query: PromiseLike<{ value: number }[]>): Promise<number> {
  const [row] = await query;
  return row?.value ?? 0;
}

export const adminUserActivityDal = {
  /** Undefined when the account does not exist. */
  async getUser(userId: string) {
    const [row] = await db
      .select({ id: user.id, name: user.name, email: user.email })
      .from(user)
      .where(eq(user.id, userId));
    return row;
  },

  countRequests(userId: string) {
    return total(
      db.select({ value: count() }).from(listings).where(eq(listings.shipperId, userId))
    );
  },

  listRequests(userId: string, { limit, offset }: Paging) {
    return db
      .select({
        ...jobColumns,
        pickupFrom: listings.pickupFrom,
        expiresAt: listings.expiresAt,
        offersCount: listings.offersCount,
        createdAt: listings.createdAt,
      })
      .from(listings)
      .where(eq(listings.shipperId, userId))
      .orderBy(desc(listings.createdAt), desc(listings.id))
      .limit(limit)
      .offset(offset);
  },

  countOffers(userId: string) {
    return total(
      db.select({ value: count() }).from(offers).where(eq(offers.carrierId, userId))
    );
  },

  listOffers(userId: string, { limit, offset }: Paging) {
    return db
      .select({
        id: offers.id,
        priceCents: offers.priceCents,
        status: offers.status,
        createdAt: offers.createdAt,
        job: jobColumns,
      })
      .from(offers)
      .innerJoin(listings, eq(listings.id, offers.listingId))
      .where(eq(offers.carrierId, userId))
      .orderBy(desc(offers.createdAt), desc(offers.id))
      .limit(limit)
      .offset(offset);
  },

  countConversations(userId: string) {
    return total(
      db
        .select({ value: count() })
        .from(conversations)
        .where(inArray(conversations.id, conversationIdsOf(userId)))
    );
  },

  listConversations(userId: string, { limit, offset }: Paging) {
    return db
      .select({
        id: conversations.id,
        type: conversations.type,
        lastMessageAt: conversations.lastMessageAt,
        createdAt: conversations.createdAt,
        job: jobColumns,
      })
      .from(conversations)
      .leftJoin(listings, eq(listings.id, conversations.listingId))
      .where(inArray(conversations.id, conversationIdsOf(userId)))
      .orderBy(desc(lastActivity), desc(conversations.id))
      .limit(limit)
      .offset(offset);
  },

  /** One conversation, only if this account is in it; undefined otherwise. */
  async getConversationOf(userId: string, conversationId: string) {
    const [row] = await db
      .select({
        id: conversations.id,
        type: conversations.type,
        lastMessageAt: conversations.lastMessageAt,
        createdAt: conversations.createdAt,
        job: jobColumns,
      })
      .from(conversations)
      .leftJoin(listings, eq(listings.id, conversations.listingId))
      .where(
        and(
          eq(conversations.id, conversationId),
          inArray(conversations.id, conversationIdsOf(userId))
        )
      );
    return row;
  },

  /** Everyone in these conversations except the account being looked at. */
  async otherParties(userId: string, conversationIds: string[]) {
    if (conversationIds.length === 0) return [];
    return db
      .selectDistinct({
        conversationId: conversationParticipants.conversationId,
        id: user.id,
        name: user.name,
      })
      .from(conversationParticipants)
      .innerJoin(user, eq(user.id, conversationParticipants.userId))
      .where(
        and(
          inArray(conversationParticipants.conversationId, conversationIds),
          ne(conversationParticipants.userId, userId)
        )
      );
  },

  async messageCounts(conversationIds: string[]) {
    if (conversationIds.length === 0) return [];
    return db
      .select({ conversationId: messages.conversationId, value: count() })
      .from(messages)
      .where(inArray(messages.conversationId, conversationIds))
      .groupBy(messages.conversationId);
  },

  countMessages(conversationId: string) {
    return total(
      db
        .select({ value: count() })
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
    );
  },

  /** Newest first. A thread offer is read from its own row, at its current status. */
  listMessages(conversationId: string, { limit, offset }: Paging) {
    return db
      .select({
        id: messages.id,
        senderId: messages.senderId,
        senderName: user.name,
        content: messages.content,
        attachmentUrl: messages.attachmentUrl,
        createdAt: messages.createdAt,
        offerPriceCents: threadOffers.priceCents,
        offerStatus: threadOffers.status,
      })
      .from(messages)
      .leftJoin(user, eq(user.id, messages.senderId))
      .leftJoin(threadOffers, eq(threadOffers.id, messages.threadOfferId))
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(limit)
      .offset(offset);
  },
};
