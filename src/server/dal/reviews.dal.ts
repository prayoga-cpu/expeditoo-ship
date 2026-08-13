import { db } from "@/db";
import { reviews, type InsertReview } from "@/db/schema/reviews";
import { eq, and, desc, count } from "drizzle-orm";

export const reviewsDal = {
  /**
   * Create a new review
   */
  async create(data: InsertReview) {
    const [result] = await db.insert(reviews).values(data).returning();
    return result;
  },

  /**
   * Get review by ID with relations
   */
  async getById(id: string) {
    return await db.query.reviews.findFirst({
      where: eq(reviews.id, id),
      with: {
        author: {
          columns: { id: true, name: true, image: true },
        },
        targetUser: {
          columns: { id: true, name: true, image: true },
        },
        listing: {
          columns: { id: true, title: true },
        },
        shipment: {
          columns: { id: true },
        },
      },
    });
  },

  /**
   * Get reviews received by a user (as seller)
   */
  async getByTargetUser(
    userId: string,
    options: { page: number; limit: number; role?: "shipper" | "carrier" }
  ) {
    const offset = (options.page - 1) * options.limit;

    // `role` records which side wrote the review, so filtering by it separates
    // "how this user performs as a carrier" from "as a shipper".
    const where = options.role
      ? and(eq(reviews.targetUserId, userId), eq(reviews.role, options.role))
      : eq(reviews.targetUserId, userId);

    const items = await db.query.reviews.findMany({
      where,
      with: {
        author: {
          columns: { id: true, name: true, image: true },
        },
        listing: {
          columns: { id: true, title: true },
        },
        shipment: {
          columns: { id: true },
        },
      },
      orderBy: [desc(reviews.createdAt)],
      limit: options.limit,
      offset: offset,
    });

    // Counted with the same predicate, so the total matches the filtered page.
    const [countResult] = await db
      .select({ count: count() })
      .from(reviews)
      .where(where);

    return {
      items,
      total: countResult?.count || 0,
    };
  },

  /**
   * Get reviews written by a user (as author)
   */
  async getByAuthor(authorId: string, options: { page: number; limit: number }) {
    const offset = (options.page - 1) * options.limit;

    const items = await db.query.reviews.findMany({
      where: eq(reviews.authorId, authorId),
      with: {
        targetUser: {
          columns: { id: true, name: true, image: true },
        },
        listing: {
          columns: { id: true, title: true },
        },
        shipment: {
          columns: { id: true },
        },
      },
      orderBy: [desc(reviews.createdAt)],
      limit: options.limit,
      offset: offset,
    });

    // Get total count
    const [countResult] = await db
      .select({ count: count() })
      .from(reviews)
      .where(eq(reviews.authorId, authorId));

    return {
      items,
      total: countResult?.count || 0,
    };
  },

  /**
   * Get reviews for a specific listing
   */
  async getByListing(listingId: string) {
    return await db.query.reviews.findMany({
      where: eq(reviews.listingId, listingId),
      with: {
        author: {
          columns: { id: true, name: true, image: true },
        },
      },
      orderBy: [desc(reviews.createdAt)],
    });
  },

  /**
   * Calculate rating statistics for a user
   */
  async getStats(userId: string) {
    // Get all ratings for distribution
    const userReviews = await db
      .select({ rating: reviews.rating })
      .from(reviews)
      .where(eq(reviews.targetUserId, userId));

    if (userReviews.length === 0) {
      return {
        average: 0,
        total: 0,
        distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      };
    }

    // Calculate distribution
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let sum = 0;

    for (const review of userReviews) {
      const rating = review.rating as 1 | 2 | 3 | 4 | 5;
      distribution[rating]++;
      sum += rating;
    }

    return {
      average: Math.round((sum / userReviews.length) * 100) / 100,
      total: userReviews.length,
      distribution,
    };
  },

  /**
   * Check if a review already exists for this author and context
   */
  async checkExists(authorId: string, listingId?: string, shipmentId?: string) {
    if (!listingId && !shipmentId) return false;

    const conditions = [eq(reviews.authorId, authorId)];

    if (listingId) {
      conditions.push(eq(reviews.listingId, listingId));
    } else if (shipmentId) {
      conditions.push(eq(reviews.shipmentId, shipmentId));
    }

    const existing = await db.query.reviews.findFirst({
      where: and(...conditions),
      columns: { id: true },
    });
    return !!existing;
  },

  /**
   * Delete a review
   */
  async delete(id: string) {
    const [deleted] = await db
      .delete(reviews)
      .where(eq(reviews.id, id))
      .returning();
    return deleted;
  },

  /**
   * Get review author (for authorization check)
   */
  async getAuthorId(id: string) {
    const review = await db.query.reviews.findFirst({
      where: eq(reviews.id, id),
      columns: { authorId: true },
    });
    return review?.authorId || null;
  },
};
