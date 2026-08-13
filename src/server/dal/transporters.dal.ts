import { db } from "@/db";
import { transporterProfiles, type InsertTransporterProfile } from "@/db/schema/transporters";
import { eq, and, desc, sql, gte } from "drizzle-orm";
import { nanoid } from "nanoid";

// ========================================
// Transporter DAL Functions
// ========================================

export const transportersDal = {
    /**
     * Get transporter profile by ID
     */
    async getById(id: string) {
        return db.query.transporterProfiles.findFirst({
            where: eq(transporterProfiles.id, id),
            with: {
                user: true,
            },
        });
    },

    /**
     * Get transporter profile by user ID
     */
    async getByUserId(userId: string) {
        return db.query.transporterProfiles.findFirst({
            where: eq(transporterProfiles.userId, userId),
            with: {
                user: true,
            },
        });
    },

    /**
     * Create transporter profile
     */
    async create(data: Omit<InsertTransporterProfile, "id" | "createdAt" | "updatedAt">) {
        const [profile] = await db
            .insert(transporterProfiles)
            .values({
                id: nanoid(),
                ...data,
            })
            .returning();

        return profile;
    },

    /**
     * Update transporter profile
     */
    async update(id: string, data: Partial<Omit<InsertTransporterProfile, "id" | "userId">>) {
        const [updated] = await db
            .update(transporterProfiles)
            .set({
                ...data,
                updatedAt: new Date(),
            })
            .where(eq(transporterProfiles.id, id))
            .returning();

        return updated;
    },

    /**
     * Get available transporters with optional filters
     */
    async getAvailable(options: {
        minRating?: number;
        limit?: number;
        offset?: number;
    } = {}) {
        const { minRating = 0, limit = 20, offset = 0 } = options;

        const whereConditions = [eq(transporterProfiles.isAvailable, true)];

        if (minRating > 0) {
            whereConditions.push(gte(transporterProfiles.averageRating, minRating));
        }

        const items = await db.query.transporterProfiles.findMany({
            where: and(...whereConditions),
            with: {
                user: true,
            },
            orderBy: desc(transporterProfiles.averageRating),
            limit,
            offset,
        });

        const [countResult] = await db
            .select({ count: sql<number>`count(*)` })
            .from(transporterProfiles)
            .where(and(...whereConditions));

        return {
            items,
            total: Number(countResult?.count) || 0,
        };
    },

    /**
     * Update transporter stats after completing a delivery
     */
    async incrementDeliveryStats(
        userId: string,
        updates: {
            completed?: boolean;
            cancelled?: boolean;
            earnings?: number; // in cents
        }
    ) {
        const profile = await this.getByUserId(userId);
        if (!profile) return null;

        const updateData: Partial<InsertTransporterProfile> = {
            totalDeliveries: profile.totalDeliveries + 1,
        };

        if (updates.completed) {
            updateData.completedDeliveries = profile.completedDeliveries + 1;
        }

        if (updates.cancelled) {
            updateData.cancelledDeliveries = profile.cancelledDeliveries + 1;
        }

        if (updates.earnings) {
            updateData.totalEarnings = profile.totalEarnings + updates.earnings;
        }

        return this.update(profile.id, updateData);
    },

    /**
     * Update transporter rating (called when new review is submitted)
     */
    async updateRating(userId: string, newRating: number) {
        const profile = await this.getByUserId(userId);
        if (!profile) return null;

        // Calculate new average
        const currentTotal = profile.averageRating * profile.totalRatings;
        const newTotalRatings = profile.totalRatings + 1;
        const newAverage = (currentTotal + newRating) / newTotalRatings;

        return this.update(profile.id, {
            averageRating: Math.round(newAverage * 10) / 10, // Round to 1 decimal
            totalRatings: newTotalRatings,
        });
    },

    /**
     * Set transporter availability
     */
    async setAvailability(userId: string, isAvailable: boolean) {
        const profile = await this.getByUserId(userId);
        if (!profile) return null;

        return this.update(profile.id, { isAvailable });
    },
};
