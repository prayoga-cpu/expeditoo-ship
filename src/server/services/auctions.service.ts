import { auctionsDAL } from "@/server/dal/auctions.dal";
import { PlaceBidInput } from "@/server/dto/auctions.dto";
import { ordersService } from "@/server/services/orders.service";
import { notificationsService } from "@/server/services/notifications.service";
import { emailService } from "@/server/services/email.service";
import { db } from "@/db";
import { user } from "@/db/schema/users";
import { eq, inArray } from "drizzle-orm";

const MIN_BID_INCREMENT = 5; // Fixed increment for now
const SOFT_CLOSE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes
const SOFT_CLOSE_EXTENSION_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Format price from cents to euros
 */
function formatPrice(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}

export const auctionsService = {
  async placeBid(listingId: string, userId: string, input: PlaceBidInput) {
    const listing = await auctionsDAL.getAuctionDetails(listingId);

    if (!listing) {
      throw new Error("Listing not found");
    }

    // 1. Validations
    if (listing.type !== "auction") {
      throw new Error("This listing is not an auction");
    }

    if (listing.status !== "active") {
      throw new Error("Auction is not active");
    }

    if (listing.sellerId === userId) {
      throw new Error("You cannot bid on your own listing");
    }

    const now = new Date();
    if (listing.endsAt && new Date(listing.endsAt) < now) {
      throw new Error("Auction has ended");
    }

    const currentPrice = listing.currentPrice || listing.startPrice || 0;

    // Check if bid is high enough
    // First bid must be >= startPrice
    // Subsequent bids must be > currentPrice + increment
    const isFirstBid = !listing.currentPrice; // If currentPrice is null/0/undefined, assume first bid?
    // Actually schema says currentPrice caches highest bid.
    // If no bids, currentPrice might be startPrice or null.
    // Let's assume if currentPrice is set, it's the highest bid.

    const minBid = isFirstBid
      ? listing.startPrice || 0
      : currentPrice + MIN_BID_INCREMENT;

    if (input.amount < minBid) {
      throw new Error(`Bid must be at least ${minBid}`);
    }

    // 2. Soft Close Logic
    let newEndsAt: Date | undefined;
    if (listing.endsAt) {
      const timeLeft = new Date(listing.endsAt).getTime() - now.getTime();
      if (timeLeft < SOFT_CLOSE_THRESHOLD_MS) {
        newEndsAt = new Date(now.getTime() + SOFT_CLOSE_EXTENSION_MS);
      }
    }

    // 3. Execute Bid
    const bid = await auctionsDAL.createBid(
      listingId,
      userId,
      input.amount,
      newEndsAt
    );

    return bid;
  },

  async getBids(listingId: string) {
    return await auctionsDAL.getBidsByListingId(listingId);
  },

  /**
   * Process all expired auctions
   * Called by cron job to close auctions that have ended
   * Sends in-app notifications AND emails to all parties
   */
  async processExpiredAuctions() {
    const expiredAuctions = await auctionsDAL.getExpiredAuctions();
    let closed = 0;
    let ordersCreated = 0;

    for (const auction of expiredAuctions) {
      try {
        // Get the highest bid for this auction
        const highestBid = await auctionsDAL.getHighestBid(auction.id);

        // Close the auction with winner (if any bids) or no winner
        await auctionsDAL.closeAuction(
          auction.id,
          highestBid?.bidderId || null
        );

        closed++;

        // Fetch seller info for email
        const sellerInfo = await db.query.user.findFirst({
          where: eq(user.id, auction.sellerId),
          columns: { email: true, name: true },
        });

        // If there's a winner, create an order and send notifications
        if (highestBid?.bidderId) {
          // Fetch winner info for emails
          const winnerInfo = await db.query.user.findFirst({
            where: eq(user.id, highestBid.bidderId),
            columns: { email: true, name: true },
          });

          // Try to create order (don't fail notifications if this fails)
          try {
            await ordersService.createFromAuctionWin(
              auction.id, // listingId
              highestBid.bidderId, // buyerId (winner)
              auction.sellerId, // sellerId
              highestBid.amount // winning bid amount
            );
            ordersCreated++;
          } catch (orderError) {
            console.error(
              `[Auction] Failed to create order for auction ${auction.id}:`,
              orderError
            );
            // Don't throw - continue to send notifications
          }

          // ========== NOTIFICATIONS (always run, even if order creation failed) ==========
          // Notify winner (in-app)
          await notificationsService.createNotification({
            userId: highestBid.bidderId,
            type: "bid",
            title: "🎉 Congratulations! You won the auction",
            message: `You won "${auction.title}" with a bid of ${formatPrice(highestBid.amount)}. Complete your purchase now!`,
            data: {
              resourceType: "listing",
              resourceId: auction.id,
              action: "checkout",
            },
          });

          // Send email to winner (fire-and-forget)
          if (winnerInfo?.email) {
            emailService.sendAuctionWinEmail(
              winnerInfo.email,
              winnerInfo.name || "Winner",
              auction.title,
              highestBid.amount,
              auction.id
            ).catch(err => console.error("[Auction] Failed to send winner email:", err));
          }

          // Notify seller (in-app)
          await notificationsService.createNotification({
            userId: auction.sellerId,
            type: "listing",
            title: "Your auction has ended",
            message: `Your auction "${auction.title}" has been sold for ${formatPrice(highestBid.amount)}.`,
            data: {
              resourceType: "listing",
              resourceId: auction.id,
            },
          });

          // Send email to seller (fire-and-forget)
          if (sellerInfo?.email) {
            emailService.sendAuctionEndedSellerEmail(
              sellerInfo.email,
              sellerInfo.name || "Seller",
              auction.title,
              true, // hasWinner
              auction.id,
              winnerInfo?.name || "Winner",
              highestBid.amount
            ).catch(err => console.error("[Auction] Failed to send seller email:", err));
          }
        } else {
          // No bids - notify seller that auction ended without bids
          await notificationsService.createNotification({
            userId: auction.sellerId,
            type: "listing",
            title: "Your auction has ended",
            message: `Your auction "${auction.title}" has ended without any bids. You can repost it if you'd like.`,
            data: {
              resourceType: "listing",
              resourceId: auction.id,
              action: "repost",
            },
          });

          // Send email to seller (no winner)
          if (sellerInfo?.email) {
            emailService.sendAuctionEndedSellerEmail(
              sellerInfo.email,
              sellerInfo.name || "Seller",
              auction.title,
              false, // hasWinner
              auction.id
            ).catch(err => console.error("[Auction] Failed to send seller email:", err));
          }
        }

        // Notify other bidders who didn't win (outbid users)
        if (highestBid) {
          const allBids = await auctionsDAL.getBidsByListingId(auction.id);
          const uniqueBidders = [...new Set(allBids.map((b) => b.bidder.id))];
          const losingBidders = uniqueBidders.filter(
            (bidderId) => bidderId !== highestBid.bidderId
          );

          // Fetch all losing bidders info in one query
          const losingBiddersInfo = losingBidders.length > 0
            ? await db.query.user.findMany({
              where: inArray(user.id, losingBidders),
              columns: { id: true, email: true, name: true },
            })
            : [];

          // Create a map for quick lookup
          const bidderInfoMap = new Map(losingBiddersInfo.map(u => [u.id, u]));

          // Get each bidder's highest bid for the email
          const bidderHighestBids = new Map<string, number>();
          for (const bid of allBids) {
            const current = bidderHighestBids.get(bid.bidder.id) || 0;
            if (bid.amount > current) {
              bidderHighestBids.set(bid.bidder.id, bid.amount);
            }
          }

          for (const loserId of losingBidders) {
            // In-app notification
            await notificationsService.createNotification({
              userId: loserId,
              type: "bid",
              title: "Auction ended",
              message: `The auction "${auction.title}" has ended. Unfortunately, you were outbid.`,
              data: {
                resourceType: "listing",
                resourceId: auction.id,
              },
            });

            // Email notification (fire-and-forget)
            const loserInfo = bidderInfoMap.get(loserId);
            if (loserInfo?.email) {
              const loserHighestBid = bidderHighestBids.get(loserId) || 0;
              emailService.sendAuctionLostEmail(
                loserInfo.email,
                loserInfo.name || "Bidder",
                auction.title,
                loserHighestBid,
                highestBid.amount
              ).catch(err => console.error(`[Auction] Failed to send lost email to ${loserId}:`, err));
            }
          }
        }
      } catch (error) {
        console.error(
          `[Auction] Failed to close auction ${auction.id}:`,
          error
        );
      }
    }

    return {
      processed: expiredAuctions.length,
      closed,
      ordersCreated,
    };
  },
};

