import { nanoid } from "nanoid";
import { reviewsDal } from "@/server/dal/reviews.dal";
import { shipmentsDal } from "@/server/dal/shipments.dal";
import { carriersDal } from "@/server/dal/carriers.dal";
import * as usersDal from "@/server/dal/users.dal";
import type {
  CreateReviewInput,
  ReviewsQuery,
} from "@/server/dto/reviews.dto";
import type { ReviewRole } from "@/db/schema/reviews";

// ========================================
// Errors
// ========================================

export class ReviewError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message?: string
  ) {
    super(message ?? code);
    this.name = "ReviewError";
  }
}

const err = (code: string, status: number) => new ReviewError(code, status);

// ========================================
// Eligibility
// ========================================

interface Counterparty {
  role: ReviewRole;
  targetUserId: string;
  listingId: string;
}

/**
 * Reviews run both ways between the two parties to a delivery
 * (ROADMAP.md §8 Phase C). Only those two may write one, only after the goods
 * actually arrived, and only once each.
 *
 * A driver is not a party here: they execute the run for the carrier, and the
 * carrier's reputation is what the shipper is rating.
 */
async function resolveCounterparty(
  shipmentId: string,
  authorId: string
): Promise<Counterparty> {
  const shipment = await shipmentsDal.getOwnership(shipmentId);
  if (!shipment) throw err("SHIPMENT_NOT_FOUND", 404);

  if (shipment.status !== "DELIVERED") {
    throw err("SHIPMENT_NOT_DELIVERED", 409);
  }

  if (shipment.shipperId === authorId) {
    return {
      role: "shipper",
      targetUserId: shipment.carrierId,
      listingId: shipment.listingId,
    };
  }

  if (shipment.carrierId === authorId) {
    return {
      role: "carrier",
      targetUserId: shipment.shipperId,
      listingId: shipment.listingId,
    };
  }

  throw err("NOT_A_PARTY_TO_SHIPMENT", 403);
}

// ========================================
// Service
// ========================================

export const reviewsService = {
  async createReview(authorId: string, data: CreateReviewInput) {
    const { role, targetUserId, listingId } = await resolveCounterparty(
      data.shipmentId,
      authorId
    );

    const already = await reviewsDal.checkExists(
      authorId,
      undefined,
      data.shipmentId
    );
    if (already) throw err("ALREADY_REVIEWED", 409);

    const review = await reviewsDal.create({
      id: nanoid(),
      authorId,
      targetUserId,
      listingId,
      shipmentId: data.shipmentId,
      role,
      rating: data.rating,
      comment: data.comment ?? null,
    });

    await this.refreshAggregates(targetUserId);

    return review;
  },

  /**
   * Tells the UI whether to offer a review button, and why not when it should
   * not - the caller gets a reason rather than a bare false.
   */
  async canReview(authorId: string, shipmentId: string) {
    try {
      const { role, targetUserId } = await resolveCounterparty(
        shipmentId,
        authorId
      );
      const already = await reviewsDal.checkExists(
        authorId,
        undefined,
        shipmentId
      );

      return already
        ? { canReview: false, reason: "ALREADY_REVIEWED" as const }
        : { canReview: true, role, targetUserId };
    } catch (error) {
      if (error instanceof ReviewError) {
        return { canReview: false, reason: error.code };
      }
      throw error;
    }
  },

  async getUserReviews(userId: string, query: ReviewsQuery) {
    return await reviewsDal.getByTargetUser(userId, {
      page: query.page,
      limit: query.limit,
      role: query.type === "all" ? undefined : query.type,
    });
  },

  async getAuthoredReviews(authorId: string, query: ReviewsQuery) {
    return await reviewsDal.getByAuthor(authorId, {
      page: query.page,
      limit: query.limit,
    });
  },

  async getListingReviews(listingId: string) {
    return await reviewsDal.getByListing(listingId);
  },

  async getReviewById(id: string) {
    const review = await reviewsDal.getById(id);
    if (!review) throw err("REVIEW_NOT_FOUND", 404);
    return review;
  },

  async getUserStats(userId: string) {
    return await reviewsDal.getStats(userId);
  },

  async deleteReview(id: string, requesterId: string, isAdmin = false) {
    const authorId = await reviewsDal.getAuthorId(id);
    if (!authorId) throw err("REVIEW_NOT_FOUND", 404);
    if (!isAdmin && authorId !== requesterId) throw err("FORBIDDEN", 403);

    const review = await reviewsDal.getById(id);
    await reviewsDal.delete(id);

    if (review) await this.refreshAggregates(review.targetUserId);
  },

  /**
   * Ratings are denormalised onto the user and, for carriers, onto the carrier
   * company - browsing offers would otherwise aggregate reviews per row.
   */
  async refreshAggregates(userId: string) {
    const stats = await reviewsDal.getStats(userId);

    await usersDal.updateUserRating(userId, stats.average);

    const carrier = await carriersDal.getByUserId(userId);
    if (carrier) {
      await carriersDal.update(carrier.id, {
        averageRating: stats.average,
        totalRatings: stats.total,
      });
    }
  },
};
