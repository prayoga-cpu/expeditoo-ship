import { earningsDal } from "@/server/dal/earnings.dal";
import type { EarningSourceType, InsertEarning } from "@/db/schema/earnings";

/**
 * Earnings Service
 * Business logic for earnings tracking
 */
export const earningsService = {
  /**
   * Record a new earning
   */
  async recordEarning(data: {
    userId: string;
    orderId?: string;
    amount: number; // in cents
    source: EarningSourceType;
    stripeTransferId?: string;
    description?: string;
  }) {
    return earningsDal.create({
      userId: data.userId,
      orderId: data.orderId,
      amount: data.amount,
      source: data.source,
      stripeTransferId: data.stripeTransferId,
      description: data.description,
      status: "completed",
    });
  },

  /**
   * Get earnings history for a user
   */
  async getEarningsHistory(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      source?: EarningSourceType;
    } = {}
  ) {
    return earningsDal.getByUserId(userId, options);
  },

  /**
   * Get earnings summary for a user
   */
  async getEarningsSummary(userId: string) {
    return earningsDal.getSummaryByUserId(userId);
  },

  /**
   * Get platform revenue (admin only)
   */
  async getPlatformRevenue() {
    return earningsDal.getAppFeesSummary();
  },
};
