import { transportersDal } from "@/server/dal/transporters.dal";
import { earningsDal } from "@/server/dal/earnings.dal";
import { getUserById } from "@/server/dal/users.dal";
import type { TransporterVehicle, TransporterServiceZone } from "@/db/schema/transporters";

export const transportersService = {
    /**
     * Get transporter profile for a user
     */
    async getProfile(userId: string) {
        const profile = await transportersDal.getByUserId(userId);
        if (!profile) return null;

        return {
            ...profile,
            user: profile.user
                ? {
                    id: profile.user.id,
                    name: profile.user.name,
                    email: profile.user.email,
                    image: profile.user.image,
                }
                : null,
        };
    },

    /**
     * Create or update transporter profile
     */
    async upsertProfile(
        userId: string,
        data: {
            vehicle: TransporterVehicle;
            serviceZones?: TransporterServiceZone[];
            bio?: string;
            maxShipmentsPerDay?: number;
        }
    ) {
        const existing = await transportersDal.getByUserId(userId);

        if (existing) {
            return transportersDal.update(existing.id, {
                vehicle: data.vehicle,
                serviceZones: data.serviceZones || existing.serviceZones,
                bio: data.bio ?? existing.bio,
                maxShipmentsPerDay: data.maxShipmentsPerDay ?? existing.maxShipmentsPerDay,
            });
        } else {
            return transportersDal.create({
                userId,
                vehicle: data.vehicle,
                serviceZones: data.serviceZones || [],
                bio: data.bio,
                maxShipmentsPerDay: data.maxShipmentsPerDay || 5,
            });
        }
    },

    /**
     * Get available transporters
     */
    async getAvailableTransporters(options: {
        minRating?: number;
        page?: number;
        limit?: number;
    } = {}) {
        const { minRating, page = 1, limit = 20 } = options;
        const offset = (page - 1) * limit;

        const result = await transportersDal.getAvailable({
            minRating,
            limit,
            offset,
        });

        return {
            transporters: result.items.map((profile) => ({
                id: profile.id,
                user: profile.user
                    ? {
                        id: profile.user.id,
                        name: profile.user.name,
                        image: profile.user.image,
                    }
                    : null,
                vehicle: profile.vehicle,
                serviceZones: profile.serviceZones,
                rating: profile.averageRating,
                totalRatings: profile.totalRatings,
                completedDeliveries: profile.completedDeliveries,
                isAvailable: profile.isAvailable,
            })),
            total: result.total,
            page,
            limit,
            totalPages: Math.ceil(result.total / limit),
        };
    },

    /**
     * Calculate and get driver earnings summary
     */
    async getEarningsSummary(userId: string) {
        const profile = await transportersDal.getByUserId(userId);
        const earnings = await earningsDal.getSummaryByUserId(userId);

        return {
            totalEarnings: profile?.totalEarnings || 0,
            completedDeliveries: profile?.completedDeliveries || 0,
            averageRating: profile?.averageRating || 0,
            totalRatings: profile?.totalRatings || 0,
            ...earnings,
        };
    },

    /**
     * Record completed delivery and update stats
     */
    async recordDeliveryCompletion(userId: string, earnedAmount: number) {
        await transportersDal.incrementDeliveryStats(userId, {
            completed: true,
            earnings: earnedAmount,
        });
    },

    /**
     * Update transporter rating
     */
    async updateRating(userId: string, rating: number) {
        return transportersDal.updateRating(userId, rating);
    },

    /**
     * Set transporter availability
     */
    async setAvailability(userId: string, isAvailable: boolean) {
        return transportersDal.setAvailability(userId, isAvailable);
    },
};
