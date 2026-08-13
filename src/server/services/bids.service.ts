import { nanoid } from "nanoid";
import { bidsDal } from "@/server/dal/bids.dal";
import { listingsDal } from "@/server/dal/listings.dal";
import { ordersDal } from "@/server/dal/orders.dal";
import { reviewsDal } from "@/server/dal/reviews.dal";
import { getUserById } from "@/server/dal/users.dal";
import type { PlaceBidInput } from "@/server/dto/bids.dto";
import { db } from "@/db";
import { listings } from "@/db/schema/listings";
import { eq } from "drizzle-orm";
import { ablyServer } from "@/lib/ably-server";
import type { NewBidEvent, OutbidEvent } from "@/server/dto/ably-events.dto";
import { notificationsService } from "@/server/services/notifications.service";

const MINIMUM_BID_INCREMENT = 500; // €5 minimum increase (in cents)

export const bidsService = {
  async placeBid(userId: string, listingId: string, data: PlaceBidInput) {
    // Get the listing
    const listing = await listingsDal.getById(listingId);

    if (!listing) {
      throw new Error("Listing not found");
    }

    if (listing.status !== "active") {
      throw new Error("Auction is not active");
    }

    if (listing.type !== "auction") {
      throw new Error("This listing is not an auction");
    }

    // Check if user is the seller
    if (listing.sellerId === userId) {
      throw new Error("You cannot bid on your own listing");
    }

    // Get current highest bid and previous bidder info
    const previousHighestBid = await bidsDal.getHighestBid(listingId);
    const previousBids = await bidsDal.getByListingId(listingId);
    const previousHighestBidder = previousBids.length > 0 ? previousBids[0] : null;

    const currentHighestBid = previousHighestBid ?? listing.startPrice ?? 0;

    // Validate bid amount
    const minimumBid = currentHighestBid + MINIMUM_BID_INCREMENT;
    if (data.amount < minimumBid) {
      throw new Error(
        `Bid must be at least €${(minimumBid / 100).toFixed(2)} (€${(
          MINIMUM_BID_INCREMENT / 100
        ).toFixed(2)} above current bid)`
      );
    }

    // Create the bid
    const bid = await bidsDal.create({
      id: nanoid(),
      listingId,
      bidderId: userId,
      amount: data.amount,
    });

    // Update listing's current price
    await db
      .update(listings)
      .set({ currentPrice: data.amount })
      .where(eq(listings.id, listingId));

    // Get bidder info for the event
    const bidderInfo = await getUserById(userId);

    // Publish real-time events via Ably
    // 1. Publish new bid to listing channel
    const newBidEvent: NewBidEvent = {
      bidId: bid.id,
      listingId,
      bidderId: userId,
      bidderName: bidderInfo?.name || null,
      bidderImage: bidderInfo?.image || null,
      amount: data.amount,
      createdAt: bid.createdAt.toISOString(),
      isHighestBid: true,
    };
    await ablyServer.publishBid(listingId, newBidEvent);

    // 2. Notify previous highest bidder that they've been outbid
    if (previousHighestBidder && previousHighestBidder.bidderId !== userId) {
      const outbidEvent: OutbidEvent = {
        listingId,
        listingTitle: listing.title,
        yourBidAmount: previousHighestBidder.amount,
        newHighestBid: data.amount,
        newHighestBidderId: userId,
      };
      await ablyServer.publishOutbid(previousHighestBidder.bidderId, outbidEvent);

      // Also create an in-app notification for persistence
      await notificationsService.createNotification({
        userId: previousHighestBidder.bidderId,
        type: "AUCTION",
        title: "You've been outbid!",
        message: `Someone placed a higher bid of €${(data.amount / 100).toFixed(2)} on "${listing.title}". Your bid was €${(previousHighestBidder.amount / 100).toFixed(2)}.`,
        data: {
          listingId,
          listingTitle: listing.title,
          previousBid: previousHighestBidder.amount,
          newHighestBid: data.amount,
        },
      });
    }

    return bid;
  },

  async getBidHistory(listingId: string) {
    return await bidsDal.getByListingId(listingId);
  },

  async getHighestBid(listingId: string) {
    return await bidsDal.getHighestBid(listingId);
  },

  async getMyBids(userId: string) {
    const userBids = await bidsDal.getByBidderId(userId);
    const now = new Date();

    // Group bids by listing and get only the user's highest bid per listing
    const bidsByListing = new Map<string, (typeof userBids)[0]>();
    for (const bid of userBids) {
      const existing = bidsByListing.get(bid.listingId);
      if (!existing || bid.amount > existing.amount) {
        bidsByListing.set(bid.listingId, bid);
      }
    }

    // Process each listing's bid
    const processedBids = await Promise.all(
      Array.from(bidsByListing.values()).map(async (bid) => {
        const listing = bid.listing;
        if (!listing) return null;

        const isEnded = listing.endsAt ? new Date(listing.endsAt) < now : false;
        const currentHighestBid = await bidsDal.getHighestBid(bid.listingId);
        const isHighestBidder = currentHighestBid === bid.amount;

        // Determine status
        let status: "WINNING" | "OUTBID" | "WON" | "LOST";
        if (isEnded) {
          status =
            isHighestBidder && listing.status === "sold" ? "WON" : "LOST";
        } else {
          status = isHighestBidder ? "WINNING" : "OUTBID";
        }

        // Get order info if won
        let orderInfo = null;
        let hasReviewedSeller = false;
        if (status === "WON") {
          const order = await ordersDal.getByListingId(listing.id);
          if (order) {
            orderInfo = {
              id: order.id,
              status: order.status,
            };

            // Check if user has already reviewed the seller for this listing
            if (order.status === "delivered") {
              hasReviewedSeller = await reviewsDal.checkExists(userId, listing.id, undefined);
            }
          }
        }

        return {
          id: bid.id,
          auctionId: bid.listingId,
          item: {
            id: listing.id,
            title: listing.title,
            image: listing.images?.[0]?.url || "/placeholder.png",
            endTime: listing.endsAt,
          },
          seller: {
            id: listing.sellerId,
            name: listing.seller?.name || "Seller",
          },
          myBidAmount: bid.amount,
          currentHighestBid:
            currentHighestBid ||
            listing.currentPrice ||
            listing.startPrice ||
            0,
          status,
          order: orderInfo,
          hasReviewedSeller,
        };
      })
    );

    return processedBids.filter((b): b is NonNullable<typeof b> => b !== null);
  },
};
