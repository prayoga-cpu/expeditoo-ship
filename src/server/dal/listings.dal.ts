import { db } from "@/db";
import {
  listings,
  listingImages,
  type InsertListing,
  type InsertListingImage,
} from "@/db/schema/listings";
import { user } from "@/db/schema/users";
import { eq, type SQL, sql } from "drizzle-orm";

export const listingsDal = {
  async create(data: InsertListing) {
    const [result] = await db.insert(listings).values(data).returning();
    return result;
  },

  async addImages(images: InsertListingImage[]) {
    if (images.length === 0) return [];
    return await db.insert(listingImages).values(images).returning();
  },

  async getById(id: string) {
    return await db.query.listings.findFirst({
      where: eq(listings.id, id),
      with: {
        images: true,
        seller: true,
        category: true,
      },
    });
  },

  async getBySellerId(sellerId: string) {
    return await db.query.listings.findMany({
      where: eq(listings.sellerId, sellerId),
      with: {
        images: true,
        category: true,
      },
      orderBy: (listings, { desc }) => [desc(listings.createdAt)],
    });
  },

  async getAllPublic(filters?: {
    search?: string;
    category?: string;
    priceMin?: number;
    priceMax?: number;
    sortBy?: string;
    sizes?: string[]; // Already split array
    minRating?: number;
    minReputation?: number;
    lat?: number;
    lng?: number;
    radiusKm?: number;
    page?: number;
    limit?: number;
  }) {
    const { and, or, like, gte, lte, inArray, desc, asc, sql, count } = await import(
      "drizzle-orm"
    );

    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions: (SQL | undefined)[] = [eq(listings.status, "active")];

    // Search filter (PostgreSQL Full-Text Search)
    let rankSql: SQL | undefined;
    if (filters?.search?.trim()) {
      const searchTerms = filters.search.trim();
      const searchQuery = sql`websearch_to_tsquery('french', ${searchTerms})`;
      const searchVector = sql`to_tsvector('french', ${listings.title} || ' ' || ${listings.description})`;

      conditions.push(sql`${searchVector} @@ ${searchQuery}`);
      rankSql = sql`ts_rank(${searchVector}, ${searchQuery})`;
    }

    // Category filter
    if (filters?.category) {
      conditions.push(eq(listings.categoryId, filters.category));
    }

    // Price range filter
    if (filters?.priceMin !== undefined) {
      conditions.push(gte(listings.currentPrice, filters.priceMin * 100));
    }
    if (filters?.priceMax !== undefined) {
      conditions.push(lte(listings.currentPrice, filters.priceMax * 100));
    }

    // Size filter
    if (filters?.sizes && filters.sizes.length > 0) {
      const validSizes = filters.sizes as any[];
      conditions.push(inArray(listings.size, validSizes));
    }

    // --- New Filters ---

    // Rating & Reputation (Seller)
    if (filters?.minRating) {
      conditions.push(gte(user.rating, filters.minRating));
    }

    if (filters?.minReputation) {
      conditions.push(gte(user.reputationScore, filters.minReputation));
    }

    // Distance (PostGIS)
    let distanceSql: SQL | undefined;
    if (filters?.lat && filters?.lng) {
      const userPoint = sql`ST_MakePoint(${filters.lng}, ${filters.lat})::geography`;
      const listingPoint = sql`ST_MakePoint(${listings.lng}, ${listings.lat})::geography`;

      if (filters.radiusKm) {
        conditions.push(sql`ST_DWithin(${listingPoint}, ${userPoint}, ${filters.radiusKm * 1000})`);
      }

      distanceSql = sql`ST_Distance(${listingPoint}, ${userPoint})`;
    }

    const whereClause = and(...conditions);

    // --- Get total count ---
    const [countResult] = await db
      .select({ count: count() })
      .from(listings)
      .leftJoin(user, eq(listings.sellerId, user.id))
      .where(whereClause);
    const totalCount = countResult?.count ?? 0;

    // --- Step 1: Query IDs matching filters with pagination ---
    const query = db
      .select({ id: listings.id })
      .from(listings)
      .leftJoin(user, eq(listings.sellerId, user.id));

    // Build order by
    let orderBy: SQL[] = [];
    const sortBy = filters?.sortBy;

    if (sortBy === "newest") orderBy = [desc(listings.createdAt)];
    else if (sortBy === "price_low") orderBy = [asc(listings.currentPrice)];
    else if (sortBy === "price_high") orderBy = [desc(listings.currentPrice)];
    else if (sortBy === "ending_soon") orderBy = [asc(listings.endsAt)];
    else if (sortBy === "distance" && distanceSql) orderBy = [asc(distanceSql)];
    else if (rankSql) orderBy = [desc(rankSql)];
    else orderBy = [asc(listings.endsAt)]; // Default fallback

    const matchedDocs = await query
      .where(whereClause)
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset);

    if (matchedDocs.length === 0) {
      return {
        data: [],
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasMore: false,
        },
      };
    }

    const ids = matchedDocs.map(d => d.id);

    // --- Step 2: Fetch Full Data ---
    const data = await db.query.listings.findMany({
      where: inArray(listings.id, ids),
      with: {
        images: {
          orderBy: (images, { asc }) => [asc(images.order)],
        },
        seller: {
          columns: {
            id: true,
            name: true,
            image: true,
            isVerified: true,
          },
        },
        category: true,
      },
    });

    // Sort in memory to match matchDocs order
    const orderMap = new Map(ids.map((id, index) => [id, index]));
    data.sort((a: { id: string }, b: { id: string }) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));

    return {
      data,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: page * limit < totalCount,
      },
    };
  },

  async updateStatus(
    id: string,
    status: "active" | "sold" | "ended" | "cancelled",
    endsAt?: Date,
    winnerId?: string | null
  ) {
    const updateData: {
      status: "active" | "sold" | "ended" | "cancelled";
      updatedAt: Date;
      endsAt?: Date;
      winnerId?: string | null;
    } = { status, updatedAt: new Date() };
    if (endsAt) {
      updateData.endsAt = endsAt;
    }
    if (winnerId !== undefined) {
      updateData.winnerId = winnerId;
    }

    const [result] = await db
      .update(listings)
      .set(updateData)
      .where(eq(listings.id, id))
      .returning();
    return result;
  },

  async delete(id: string) {
    // Images are cascade deleted due to schema definition
    const [result] = await db
      .delete(listings)
      .where(eq(listings.id, id))
      .returning();
    return result;
  },

  async getOwner(id: string) {
    const result = await db.query.listings.findFirst({
      where: eq(listings.id, id),
      columns: { sellerId: true },
    });
    return result?.sellerId;
  },

  async update(id: string, data: Partial<InsertListing>) {
    const [result] = await db
      .update(listings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(listings.id, id))
      .returning();
    return result;
  },

  async deleteImagesByListingId(listingId: string) {
    await db
      .delete(listingImages)
      .where(eq(listingImages.listingId, listingId));
  },

  async getAllForAdmin() {
    const { desc } = await import("drizzle-orm");

    return await db.query.listings.findMany({
      with: {
        images: {
          orderBy: (images, { asc }) => [asc(images.order)],
          limit: 1,
        },
        seller: {
          columns: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        category: true,
      },
      orderBy: [desc(listings.createdAt)],
      limit: 100,
    });
  },
  async incrementView(id: string) {
    const { sql } = await import("drizzle-orm");
    await db
      .update(listings)
      .set({ views: sql`${listings.views} + 1` })
      .where(eq(listings.id, id));
  },

  /**
   * Get category counts for faceted search
   */
  async getCategoryCounts() {
    const { count, eq } = await import("drizzle-orm");
    const { categories } = await import("@/db/schema/listings");

    const results = await db
      .select({
        categoryId: listings.categoryId,
        categoryName: categories.name,
        count: count(),
      })
      .from(listings)
      .leftJoin(categories, eq(listings.categoryId, categories.id))
      .where(eq(listings.status, "active"))
      .groupBy(listings.categoryId, categories.name);

    return results.map((r) => ({
      id: r.categoryId,
      name: r.categoryName || "Uncategorized",
      count: Number(r.count),
    }));
  },
};
