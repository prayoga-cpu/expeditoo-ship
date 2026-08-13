import { db } from "@/db";
import { searchAnalytics, type InsertSearchAnalytic } from "@/db/schema/search-analytics";
import { eq, desc, sql, count, gte } from "drizzle-orm";
import { nanoid } from "nanoid";

// ========================================
// Search Analytics DAL Functions
// ========================================

export const searchAnalyticsDal = {
    /**
     * Track a search query
     */
    async trackSearch(data: Omit<InsertSearchAnalytic, "id" | "createdAt">) {
        const [record] = await db
            .insert(searchAnalytics)
            .values({
                id: nanoid(),
                ...data,
            })
            .returning();

        return record;
    },

    /**
     * Track a click from search results
     */
    async trackClick(searchId: string, listingId: string) {
        const [updated] = await db
            .update(searchAnalytics)
            .set({ clickedListingId: listingId })
            .where(eq(searchAnalytics.id, searchId))
            .returning();

        return updated;
    },

    /**
     * Get top search queries (for popular searches)
     */
    async getTopQueries(limit = 10, days = 30) {
        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - days);

        const results = await db
            .select({
                query: searchAnalytics.query,
                count: count(),
            })
            .from(searchAnalytics)
            .where(gte(searchAnalytics.createdAt, sinceDate))
            .groupBy(searchAnalytics.query)
            .orderBy(desc(count()))
            .limit(limit);

        return results.map((r) => ({
            query: r.query,
            count: Number(r.count),
        }));
    },

    /**
     * Get search analytics summary
     */
    async getSummary(days = 30) {
        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - days);

        const [stats] = await db
            .select({
                totalSearches: count(),
                avgResults: sql<number>`avg(results_count)`,
                clickThroughCount: sql<number>`count(*) filter (where clicked_listing_id is not null)`,
            })
            .from(searchAnalytics)
            .where(gte(searchAnalytics.createdAt, sinceDate));

        return {
            totalSearches: Number(stats?.totalSearches) || 0,
            avgResults: Math.round(Number(stats?.avgResults) || 0),
            clickThroughCount: Number(stats?.clickThroughCount) || 0,
            clickThroughRate:
                stats?.totalSearches
                    ? Math.round((Number(stats.clickThroughCount) / Number(stats.totalSearches)) * 100)
                    : 0,
        };
    },

    /**
     * Get recent searches for a user
     */
    async getUserRecentSearches(userId: string, limit = 10) {
        const results = await db
            .select({
                query: searchAnalytics.query,
                createdAt: searchAnalytics.createdAt,
            })
            .from(searchAnalytics)
            .where(eq(searchAnalytics.userId, userId))
            .orderBy(desc(searchAnalytics.createdAt))
            .limit(limit);

        // Get unique queries
        const seen = new Set<string>();
        return results
            .filter((r) => {
                if (seen.has(r.query)) return false;
                seen.add(r.query);
                return true;
            })
            .slice(0, limit);
    },
};
