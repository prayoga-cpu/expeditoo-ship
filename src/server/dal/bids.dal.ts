import { db } from "@/db";
import { bids, type InsertBid } from "@/db/schema/auctions";
import { eq, desc } from "drizzle-orm";

export const bidsDal = {
  async create(data: InsertBid) {
    const [result] = await db.insert(bids).values(data).returning();
    return result;
  },

  async getByListingId(listingId: string) {
    return await db.query.bids.findMany({
      where: eq(bids.listingId, listingId),
      with: {
        bidder: {
          columns: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: [desc(bids.amount)],
    });
  },

  async getHighestBid(listingId: string) {
    const result = await db.query.bids.findFirst({
      where: eq(bids.listingId, listingId),
      orderBy: [desc(bids.amount)],
    });
    return result?.amount ?? null;
  },

  async getByBidderId(bidderId: string) {
    return await db.query.bids.findMany({
      where: eq(bids.bidderId, bidderId),
      with: {
        listing: {
          columns: {
            id: true,
            title: true,
            status: true,
            endsAt: true,
            currentPrice: true,
            startPrice: true,
            sellerId: true,
          },
          with: {
            images: {
              columns: { url: true },
              limit: 1,
            },
            seller: {
              columns: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: [desc(bids.createdAt)],
    });
  },
};
