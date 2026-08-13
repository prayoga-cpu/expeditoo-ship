import { db } from "@/db";
import { bids } from "@/db/schema/auctions";
import { listings } from "@/db/schema/listings";
import { user } from "@/db/schema/users";
import { eq, desc, and, lt, isNotNull } from "drizzle-orm";
import { nanoid } from "nanoid";

export const auctionsDAL = {
  async createBid(
    listingId: string,
    bidderId: string,
    amount: number,
    newEndsAt?: Date
  ) {
    return await db.transaction(async (tx) => {
      // 1. Create the bid
      const [newBid] = await tx
        .insert(bids)
        .values({
          id: nanoid(),
          listingId,
          bidderId,
          amount,
        })
        .returning();

      // 2. Update the listing current price and potentially end time
      await tx
        .update(listings)
        .set({
          currentPrice: amount,
          ...(newEndsAt ? { endsAt: newEndsAt } : {}),
        })
        .where(eq(listings.id, listingId));

      return newBid;
    });
  },

  async getBidsByListingId(listingId: string) {
    return await db
      .select({
        id: bids.id,
        amount: bids.amount,
        createdAt: bids.createdAt,
        bidder: {
          id: user.id,
          name: user.name,
          image: user.image,
        },
      })
      .from(bids)
      .innerJoin(user, eq(bids.bidderId, user.id))
      .where(eq(bids.listingId, listingId))
      .orderBy(desc(bids.amount));
  },

  async getAuctionDetails(listingId: string) {
    return await db.query.listings.findFirst({
      where: eq(listings.id, listingId),
      with: {
        seller: true,
      },
    });
  },

  /**
   * Get all expired active auctions
   */
  async getExpiredAuctions() {
    const now = new Date();
    return await db.query.listings.findMany({
      where: and(
        eq(listings.type, "auction"),
        eq(listings.status, "active"),
        isNotNull(listings.endsAt),
        lt(listings.endsAt, now)
      ),
    });
  },

  /**
   * Close an auction and set winner
   */
  async closeAuction(listingId: string, winnerId: string | null) {
    const [result] = await db
      .update(listings)
      .set({
        status: winnerId ? "sold" : "ended",
        winnerId: winnerId, // Store winner permanently
        updatedAt: new Date(),
      })
      .where(eq(listings.id, listingId))
      .returning();
    return result;
  },

  /**
   * Get highest bidder for a listing
   */
  async getHighestBid(listingId: string) {
    const result = await db
      .select({
        id: bids.id,
        bidderId: bids.bidderId,
        amount: bids.amount,
      })
      .from(bids)
      .where(eq(bids.listingId, listingId))
      .orderBy(desc(bids.amount))
      .limit(1);
    return result[0] || null;
  },
};
