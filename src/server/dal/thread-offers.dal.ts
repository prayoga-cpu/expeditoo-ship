import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  threadOffers,
  type InsertThreadOffer,
  type ThreadOfferStatus,
} from "@/db/schema";

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Data access for offers sent inside a conversation.
 *
 * Permission-blind, as every DAL is (docs/rules.md §3.3). Who may send, accept
 * or withdraw is `threadOffersService`'s question.
 */
export const threadOffersDal = {
  async create(data: InsertThreadOffer, tx: Executor = db) {
    const [created] = await tx.insert(threadOffers).values(data).returning();
    return created;
  },

  /** The row plus everything the card renders, including the joined bid. */
  async getById(id: string) {
    return await db.query.threadOffers.findFirst({
      where: eq(threadOffers.id, id),
      with: {
        offer: {
          columns: { id: true, listingId: true, status: true, carrierId: true },
        },
        vehicle: {
          columns: { id: true, type: true, make: true, model: true },
        },
      },
    });
  },

  /** The sender's live offer in this thread, if any. */
  async getPendingBySender(conversationId: string, senderId: string) {
    return await db.query.threadOffers.findFirst({
      where: and(
        eq(threadOffers.conversationId, conversationId),
        eq(threadOffers.senderId, senderId),
        eq(threadOffers.status, "pending")
      ),
    });
  },

  async updateStatus(
    id: string,
    status: ThreadOfferStatus,
    respondedBy: string | null,
    tx: Executor = db
  ) {
    const [updated] = await tx
      .update(threadOffers)
      .set({
        status,
        // Only a response by the *other* party stamps these. A withdrawal is
        // the sender retracting, not a decision on the offer.
        ...(respondedBy
          ? { respondedBy, respondedAt: new Date() }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(threadOffers.id, id))
      .returning();
    return updated;
  },

  async linkOffer(id: string, offerId: string, tx: Executor = db) {
    const [updated] = await tx
      .update(threadOffers)
      .set({ offerId, updatedAt: new Date() })
      .where(eq(threadOffers.id, id))
      .returning();
    return updated;
  },
};
