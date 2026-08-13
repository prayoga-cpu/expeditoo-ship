import { nanoid } from "nanoid";
import { listingsDal } from "@/server/dal/listings.dal";
import { bidsDal } from "@/server/dal/bids.dal";
import { calculateSize, type CreateListingInput } from "@/server/dto/listings.dto";
import { addDays } from "date-fns";
import { notificationsService } from "@/server/services/notifications.service";
import { emailService } from "@/server/services/email.service";
import { db } from "@/db";
import { user } from "@/db/schema/users";
import { eq, inArray } from "drizzle-orm";

export const listingsService = {
  async createListing(userId: string, data: CreateListingInput) {
    const listingId = nanoid();

    // Calculate size
    const size = calculateSize(data.length, data.width, data.height);

    // Calculate endsAt for auction
    let endsAt: Date | undefined;
    if (data.type === "auction" && data.auctionDuration) {
      endsAt = addDays(new Date(), parseInt(data.auctionDuration));
    }

    // Create listing
    const listing = await listingsDal.create({
      id: listingId,
      sellerId: userId,
      title: data.title,
      description: data.description,
      categoryId: data.categoryId,
      condition: data.condition,
      type: data.type,
      status: "active",

      // Pricing
      startPrice: data.startPrice,
      buyNowPrice: data.buyNowPrice,
      currentPrice: data.startPrice || 0,

      // Dimensions
      length: data.length,
      width: data.width,
      height: data.height,
      weight: data.weight,
      size: size,

      // Location
      lat: data.location.lat,
      lng: data.location.lng,
      address: data.location.address,
      city: data.location.city,

      // Metadata
      endsAt: endsAt,
    });

    // Add images
    if (data.images.length > 0) {
      const imageInserts = data.images.map((url, index) => ({
        id: nanoid(),
        listingId: listingId,
        url: url,
        order: index,
      }));
      await listingsDal.addImages(imageInserts);
    }

    return listing;
  },

  async getListingsBySeller(userId: string) {
    const listings = await listingsDal.getBySellerId(userId);

    // Fetch bid counts for all listings
    const listingsWithBids = await Promise.all(
      listings.map(async (listing) => {
        const bids = await bidsDal.getByListingId(listing.id);
        return {
          ...listing,
          bidCount: bids.length,
        };
      })
    );

    return listingsWithBids;
  },

  async getListingById(id: string) {
    // Increment view count
    await listingsDal.incrementView(id);

    const listing = await listingsDal.getById(id);

    if (!listing) return undefined;

    // Lazy update: Check if auction has ended but status is still active
    if (
      listing.type === "auction" &&
      listing.status === "active" &&
      listing.endsAt &&
      new Date(listing.endsAt) < new Date()
    ) {
      // Check if there are bids
      const bids = await bidsDal.getByListingId(id);
      const newStatus = bids.length > 0 ? "sold" : "ended";

      // Update status
      await listingsDal.updateStatus(id, newStatus);

      // Return updated listing
      return { ...listing, status: newStatus };
    }

    return listing;
  },

  async getPublicListings(query: {
    search?: string;
    category?: string;
    priceMin?: number;
    priceMax?: number;
    sortBy?: string;
    sizes?: string;
    minRating?: number;
    minReputation?: number;
    lat?: number;
    lng?: number;
    radiusKm?: number;
    page?: number;
    limit?: number;
  }) {
    // Parse sizes if provided (comma-separated string to array)
    const sizesArray = query.sizes
      ? query.sizes.split(",").map((s) => s.trim())
      : undefined;

    const result = await listingsDal.getAllPublic({
      search: query.search,
      category: query.category,
      priceMin: query.priceMin,
      priceMax: query.priceMax,
      sortBy: query.sortBy || "ending_soon",
      sizes: sizesArray,
      minRating: query.minRating,
      minReputation: query.minReputation,
      lat: query.lat,
      lng: query.lng,
      radiusKm: query.radiusKm,
      page: query.page,
      limit: query.limit,
    });

    // Fetch bid counts for all listings
    const listingsWithBids = await Promise.all(
      result.data.map(async (listing) => {
        const bids = await bidsDal.getByListingId(listing.id);
        return {
          ...listing,
          bidCount: bids.length,
        };
      })
    );

    return {
      data: listingsWithBids,
      pagination: result.pagination,
    };
  },

  async updateListingStatus(
    listingId: string,
    userId: string,
    status: "ended" | "cancelled"
  ) {
    // Verify ownership
    const owner = await listingsDal.getOwner(listingId);
    if (!owner) {
      throw new Error("Listing not found");
    }
    if (owner !== userId) {
      throw new Error("Not authorized to modify this listing");
    }

    // When manually ending, check if there are bids to determine final status
    let finalStatus: "ended" | "sold" | "cancelled" = status;
    let winnerId: string | null = null;
    let winningAmount: number = 0;

    if (status === "ended") {
      // Check if auction has bids - if yes, it's sold (winner can checkout)
      const bids = await bidsDal.getByListingId(listingId);
      if (bids.length > 0) {
        // Get highest bid - bids are sorted by amount desc
        const highestBid = bids[0];
        winnerId = highestBid.bidderId;
        winningAmount = highestBid.amount;
        finalStatus = "sold"; // Has winner - buyer can checkout
      }
      // If no bids, stays "ended" - auction finished with no winner
    }

    // Set endsAt to now so it shows as finished immediately
    // Also set winnerId if there was a winner
    const updatedListing = await listingsDal.updateStatus(
      listingId,
      finalStatus,
      new Date(),
      winnerId
    );

    // Get listing title for notifications
    const listing = await listingsDal.getById(listingId);
    const listingTitle = listing?.title || "Auction";

    // Helper function to format price
    const formatPrice = (cents: number) => `€${(cents / 100).toFixed(2)}`;

    // If there's a winner, create order and send notifications
    if (winnerId && winningAmount > 0) {
      try {
        const { ordersService } = await import("./orders.service");
        await ordersService.createFromAuctionWin(
          listingId,
          winnerId,
          userId, // seller
          winningAmount
        );
        console.log(
          `[Listings] Created order for manually ended auction ${listingId}`
        );
      } catch (orderError) {
        console.error(
          `[Listings] Failed to create order for ${listingId}:`,
          orderError
        );
        // Don't throw - continue to send notifications
      }

      // ========== SEND NOTIFICATIONS (same as cron job) ==========
      // Fetch winner and seller info
      const winnerInfo = await db.query.user.findFirst({
        where: eq(user.id, winnerId),
        columns: { email: true, name: true },
      });
      const sellerInfo = await db.query.user.findFirst({
        where: eq(user.id, userId),
        columns: { email: true, name: true },
      });

      // Notify winner (in-app)
      await notificationsService.createNotification({
        userId: winnerId,
        type: "bid",
        title: "🎉 Congratulations! You won the auction",
        message: `You won "${listingTitle}" with a bid of ${formatPrice(winningAmount)}. Complete your purchase now!`,
        data: {
          resourceType: "listing",
          resourceId: listingId,
          action: "checkout",
        },
      });

      // Email to winner (fire-and-forget)
      if (winnerInfo?.email) {
        emailService.sendAuctionWinEmail(
          winnerInfo.email,
          winnerInfo.name || "Winner",
          listingTitle,
          winningAmount,
          listingId
        ).catch(err => console.error("[Listings] Failed to send winner email:", err));
      }

      // Notify seller (in-app)
      await notificationsService.createNotification({
        userId: userId,
        type: "listing",
        title: "Your auction has ended",
        message: `Your auction "${listingTitle}" has been sold for ${formatPrice(winningAmount)}.`,
        data: {
          resourceType: "listing",
          resourceId: listingId,
        },
      });

      // Email to seller (fire-and-forget)
      if (sellerInfo?.email) {
        emailService.sendAuctionEndedSellerEmail(
          sellerInfo.email,
          sellerInfo.name || "Seller",
          listingTitle,
          true,
          listingId,
          winnerInfo?.name || "Winner",
          winningAmount
        ).catch(err => console.error("[Listings] Failed to send seller email:", err));
      }

      // Notify losing bidders
      const allBids = await bidsDal.getByListingId(listingId);
      const uniqueBidders = [...new Set(allBids.map(b => b.bidderId))];
      const losingBidders = uniqueBidders.filter(bidderId => bidderId !== winnerId);

      if (losingBidders.length > 0) {
        const losingBiddersInfo = await db.query.user.findMany({
          where: inArray(user.id, losingBidders),
          columns: { id: true, email: true, name: true },
        });
        const bidderInfoMap = new Map(losingBiddersInfo.map(u => [u.id, u]));

        // Get each bidder's highest bid
        const bidderHighestBids = new Map<string, number>();
        for (const bid of allBids) {
          const current = bidderHighestBids.get(bid.bidderId) || 0;
          if (bid.amount > current) {
            bidderHighestBids.set(bid.bidderId, bid.amount);
          }
        }

        for (const loserId of losingBidders) {
          // In-app notification
          await notificationsService.createNotification({
            userId: loserId,
            type: "bid",
            title: "Auction ended",
            message: `The auction "${listingTitle}" has ended. Unfortunately, you were outbid.`,
            data: {
              resourceType: "listing",
              resourceId: listingId,
            },
          });

          // Email (fire-and-forget)
          const loserInfo = bidderInfoMap.get(loserId);
          if (loserInfo?.email) {
            const loserHighestBid = bidderHighestBids.get(loserId) || 0;
            emailService.sendAuctionLostEmail(
              loserInfo.email,
              loserInfo.name || "Bidder",
              listingTitle,
              loserHighestBid,
              winningAmount
            ).catch(err => console.error(`[Listings] Failed to send lost email to ${loserId}:`, err));
          }
        }
      }
    } else {
      // No winner - notify seller that auction ended without bids
      const sellerInfo = await db.query.user.findFirst({
        where: eq(user.id, userId),
        columns: { email: true, name: true },
      });

      await notificationsService.createNotification({
        userId: userId,
        type: "listing",
        title: "Your auction has ended",
        message: `Your auction "${listingTitle}" has ended without any bids. You can repost it if you'd like.`,
        data: {
          resourceType: "listing",
          resourceId: listingId,
          action: "repost",
        },
      });

      if (sellerInfo?.email) {
        emailService.sendAuctionEndedSellerEmail(
          sellerInfo.email,
          sellerInfo.name || "Seller",
          listingTitle,
          false,
          listingId
        ).catch(err => console.error("[Listings] Failed to send seller email:", err));
      }
    }

    return updatedListing;
  },

  async updateListing(
    listingId: string,
    userId: string,
    data: CreateListingInput
  ) {
    // Verify ownership
    const owner = await listingsDal.getOwner(listingId);
    if (!owner) {
      throw new Error("Listing not found");
    }
    if (owner !== userId) {
      throw new Error("Not authorized to modify this listing");
    }

    // Calculate size
    const size = calculateSize(data.length, data.width, data.height);

    // Update listing
    const listing = await listingsDal.update(listingId, {
      title: data.title,
      description: data.description,
      categoryId: data.categoryId,
      condition: data.condition,
      type: data.type,
      startPrice: data.startPrice,
      buyNowPrice: data.buyNowPrice,
      length: data.length,
      width: data.width,
      height: data.height,
      weight: data.weight,
      size: size,
      lat: data.location.lat,
      lng: data.location.lng,
      address: data.location.address,
      city: data.location.city,
    });

    // Update images - delete old and add new
    await listingsDal.deleteImagesByListingId(listingId);
    if (data.images.length > 0) {
      const imageInserts = data.images.map((url, index) => ({
        id: nanoid(),
        listingId: listingId,
        url: url,
        order: index,
      }));
      await listingsDal.addImages(imageInserts);
    }

    return listing;
  },

  async deleteListing(listingId: string, userId: string) {
    // Verify ownership
    const owner = await listingsDal.getOwner(listingId);
    if (!owner) {
      throw new Error("Listing not found");
    }

    // Check if user is admin or owner
    const isAdmin = await import("./user.service").then((m) =>
      m.hasRole(userId, "admin")
    );

    if (owner !== userId && !isAdmin) {
      throw new Error("Not authorized to delete this listing");
    }

    return await listingsDal.delete(listingId);
  },

  async repostListing(
    listingId: string,
    userId: string,
    auctionDuration: string
  ) {
    // Verify ownership
    const owner = await listingsDal.getOwner(listingId);
    if (!owner) {
      throw new Error("Listing not found");
    }
    if (owner !== userId) {
      throw new Error("Not authorized to repost this listing");
    }

    // Get original listing
    const original = await listingsDal.getById(listingId);
    if (!original) {
      throw new Error("Listing not found");
    }

    // Create new listing based on original
    const newListingId = nanoid();
    const endsAt = addDays(new Date(), parseInt(auctionDuration));

    const newListing = await listingsDal.create({
      id: newListingId,
      sellerId: userId,
      title: original.title,
      description: original.description,
      categoryId: original.categoryId,
      condition: original.condition,
      type: original.type,
      status: "active",
      startPrice: original.startPrice,
      buyNowPrice: original.buyNowPrice,
      currentPrice: original.startPrice || 0,
      length: original.length,
      width: original.width,
      height: original.height,
      weight: original.weight,
      size: original.size,
      lat: original.lat,
      lng: original.lng,
      address: original.address,
      city: original.city,
      endsAt: endsAt,
    });

    // Copy images
    if (original.images && original.images.length > 0) {
      const imageInserts = original.images.map((img, index) => ({
        id: nanoid(),
        listingId: newListingId,
        url: img.url,
        order: index,
      }));
      await listingsDal.addImages(imageInserts);
    }

    return newListing;
  },

  async getAllListingsForAdmin() {
    const listings = await listingsDal.getAllForAdmin();

    // Format for admin UI
    return listings.map((listing) => ({
      id: listing.id,
      title: listing.title,
      seller: listing.seller
        ? {
          id: listing.seller.id,
          name: listing.seller.name,
          email: listing.seller.email,
        }
        : null,
      sellerId: listing.sellerId,
      currentPrice: listing.currentPrice,
      buyNowPrice: listing.buyNowPrice,
      startPrice: listing.startPrice,
      status: listing.status,
      createdAt: listing.createdAt.toISOString(),
      views: listing.views,
    }));
  },
};
