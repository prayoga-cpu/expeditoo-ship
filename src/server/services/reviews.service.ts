import { nanoid } from "nanoid";
import { reviewsDal } from "../dal/reviews.dal";
import { listingsDal } from "../dal/listings.dal";
import { auctionsDAL } from "../dal/auctions.dal";
import { shipmentsDal } from "../dal/shipments.dal";
import { ordersDal } from "../dal/orders.dal";
import {
  createReviewSchema,
  type CreateReviewInput,
  type ReviewsQuery,
} from "../dto/reviews.dto";
import type { ReviewRole } from "@/db/schema/reviews";

export const reviewsService = {
  /**
   * Create a new review
   * Supports:
   * - Buyer -> Seller (Listing)
   * - Seller -> Buyer (Listing)
   * - Client -> Driver (Shipment)
   * - Driver -> Client (Shipment)
   */
  async createReview(authorId: string, data: CreateReviewInput) {
    // Validate input
    const validated = createReviewSchema.parse(data);

    // Check if check exists
    const exists = await reviewsDal.checkExists(
      authorId,
      validated.listingId,
      validated.shipmentId
    );

    if (exists) {
      throw new Error("ALREADY_REVIEWED: You have already reviewed this transaction");
    }

    let role: ReviewRole;

    // ==========================================
    // Creating Review for Listing (Item Sale)
    // ==========================================
    if (validated.listingId) {
      const listing = await listingsDal.getById(validated.listingId);
      if (!listing) {
        throw new Error("LISTING_NOT_FOUND: Listing not found");
      }

      // Determine Winner/Buyer
      let buyerId = listing.winnerId;
      if (!buyerId) {
        const highestBid = await auctionsDAL.getHighestBid(listing.id);
        buyerId = highestBid?.bidderId || null;
      }

      // Check Status
      const isCompleted = listing.status === "sold" || listing.status === "ended";
      if (!isCompleted) {
        // Double check orders if listing status is lagging
        const order = await ordersDal.getByListingId(listing.id);
        if (!order || (order.status !== "delivered" && order.status !== "paid")) {
          throw new Error("TRANSACTION_NOT_COMPLETE: Listing/Order is not completed");
        }
      }

      // Determine Role
      if (authorId === buyerId) {
        role = "buyer";
        if (validated.targetUserId !== listing.sellerId) {
          throw new Error("INVALID_TARGET: Buyer must review Seller");
        }
      } else if (authorId === listing.sellerId) {
        role = "seller";
        if (validated.targetUserId !== buyerId) {
          throw new Error("INVALID_TARGET: Seller must review Buyer");
        }
      } else {
        throw new Error("NOT_AUTHORIZED: You are not a participant in this transaction");
      }
    }
    // ==========================================
    // Creating Review for Shipment (Delivery)
    // ==========================================
    else if (validated.shipmentId) {
      const shipment = await shipmentsDal.getById(validated.shipmentId);
      if (!shipment) {
        throw new Error("SHIPMENT_NOT_FOUND: Shipment not found");
      }

      // Check Status
      if (shipment.status !== "DELIVERED") {
        throw new Error("SHIPMENT_NOT_COMPLETE: Shipment must be delivered first");
      }

      // Determine Role
      if (authorId === shipment.userId) {
        // Client reviewing Driver
        role = "client";
        if (validated.targetUserId !== shipment.driverId) {
          throw new Error("INVALID_TARGET: Client must review Driver");
        }
      } else if (authorId === shipment.driverId) {
        // Driver reviewing Client
        role = "driver";
        if (validated.targetUserId !== shipment.userId) {
          throw new Error("INVALID_TARGET: Driver must review Client");
        }
      } else {
        throw new Error("NOT_AUTHORIZED: You are not a participant in this shipment");
      }
    } else {
      throw new Error("INVALID_CONTEXT: Must provide listingId or shipmentId");
    }

    // Create the review
    const review = await reviewsDal.create({
      id: nanoid(),
      authorId: authorId,
      targetUserId: validated.targetUserId,
      listingId: validated.listingId,
      shipmentId: validated.shipmentId,
      role: role,
      rating: validated.rating,
      comment: validated.comment,
    });

    return review;
  },

  /**
   * Get reviews received by a user
   */
  async getUserReviews(userId: string, query: ReviewsQuery) {
    const { items, total } = await reviewsDal.getByTargetUser(userId, {
      page: query.page,
      limit: query.limit,
    });

    return {
      items,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  },

  /**
   * Get reviews written by a user
   */
  async getAuthoredReviews(authorId: string, query: ReviewsQuery) {
    const { items, total } = await reviewsDal.getByAuthor(authorId, {
      page: query.page,
      limit: query.limit,
    });

    return {
      items,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  },

  /**
   * Get rating statistics for a user
   */
  async getUserStats(userId: string) {
    return await reviewsDal.getStats(userId);
  },

  /**
   * Get a single review by ID
   */
  async getReviewById(id: string) {
    return await reviewsDal.getById(id);
  },

  /**
   * Delete a review (only by author)
   */
  async deleteReview(id: string, userId: string) {
    // Check if user is the author
    const authorId = await reviewsDal.getAuthorId(id);
    if (!authorId) {
      throw new Error("REVIEW_NOT_FOUND: Review not found");
    }
    if (authorId !== userId) {
      throw new Error("NOT_AUTHORIZED: You can only delete your own reviews");
    }

    return await reviewsDal.delete(id);
  },

  /**
   * Get reviews for a specific listing
   */
  async getListingReviews(listingId: string) {
    return await reviewsDal.getByListing(listingId);
  },

  /**
   * Check if user can review a listing or shipment
   */
  async canReview(userId: string, context: { listingId?: string, shipmentId?: string }) {
    // Check existence
    const exists = await reviewsDal.checkExists(userId, context.listingId, context.shipmentId);
    if (exists) {
      return { canReview: false, reason: "Already reviewed" };
    }

    if (context.listingId) {
      const listing = await listingsDal.getById(context.listingId);
      if (!listing) return { canReview: false, reason: "Listing not found" };

      // Check completion
      if (listing.status !== 'sold' && listing.status !== 'ended') {
        // Check order fallback
        const order = await ordersDal.getByListingId(listing.id);
        if (!order || (order.status !== "delivered" && order.status !== "paid")) {
          return { canReview: false, reason: "Transaction not complete" };
        }
      }

      // Check participation
      let buyerId = listing.winnerId;
      if (!buyerId) {
        const highestBid = await auctionsDAL.getHighestBid(listing.id);
        buyerId = highestBid?.bidderId || null;
      }

      if (userId === buyerId) return { canReview: true, role: 'buyer' };
      if (userId === listing.sellerId) return { canReview: true, role: 'seller' };

      return { canReview: false, reason: "Not a participant" };
    }

    if (context.shipmentId) {
      const shipment = await shipmentsDal.getById(context.shipmentId);
      if (!shipment) return { canReview: false, reason: "Shipment not found" };

      if (shipment.status !== 'DELIVERED') return { canReview: false, reason: "Shipment not delivered" };

      if (userId === shipment.userId) return { canReview: true, role: 'client' };
      if (userId === shipment.driverId) return { canReview: true, role: 'driver' };

      return { canReview: false, reason: "Not a participant" };
    }

    return { canReview: false, reason: "No context provided" };
  },
};
