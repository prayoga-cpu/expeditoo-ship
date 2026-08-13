import { db } from "@/db";
import { earnings } from "@/db/schema/earnings";
import { orders } from "@/db/schema/orders";
import { listings } from "@/db/schema/listings";
import { eq, desc, and, sql, count, sum } from "drizzle-orm";
import type { EarningSourceType, InsertEarning } from "@/db/schema/earnings";

/**
 * Earnings Data Access Layer
 * Pure database operations, no business logic
 */
export const earningsDal = {
  /**
   * Create a new earning record
   */
  async create(data: InsertEarning) {
    const [earning] = await db.insert(earnings).values(data).returning();
    return earning;
  },

  /**
   * Get earnings for a user with pagination
   */
  async getByUserId(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      source?: EarningSourceType;
    } = {}
  ) {
    const { limit = 20, offset = 0, source } = options;

    const conditions = [eq(earnings.userId, userId)];
    if (source) {
      conditions.push(eq(earnings.source, source));
    }

    const items = await db.query.earnings.findMany({
      where: and(...conditions),
      orderBy: [desc(earnings.createdAt)],
      limit,
      offset,
      with: {
        order: {
          columns: {
            id: true,
            itemPrice: true,
            shippingPrice: true,
          },
          with: {
            listing: {
              columns: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
    });

    // Get total count
    const [countResult] = await db
      .select({ count: count() })
      .from(earnings)
      .where(and(...conditions));

    return {
      items,
      total: countResult?.count ?? 0,
    };
  },

  /**
   * Get earnings summary (totals by source)
   */
  async getSummaryByUserId(userId: string) {
    const result = await db
      .select({
        source: earnings.source,
        totalAmount: sum(earnings.amount),
        count: count(),
      })
      .from(earnings)
      .where(and(eq(earnings.userId, userId), eq(earnings.status, "completed")))
      .groupBy(earnings.source);

    // Convert to structured object
    const summary = {
      sale: { amount: 0, count: 0 },
      delivery: { amount: 0, count: 0 },
      total: { amount: 0, count: 0 },
    };

    for (const row of result) {
      const amount = Number(row.totalAmount) || 0;
      const rowCount = Number(row.count) || 0;

      if (row.source === "sale") {
        summary.sale = { amount, count: rowCount };
      } else if (row.source === "delivery") {
        summary.delivery = { amount, count: rowCount };
      }

      summary.total.amount += amount;
      summary.total.count += rowCount;
    }

    return summary;
  },

  /**
   * Get platform app fees (for admin)
   */
  async getAppFeesSummary() {
    const result = await db
      .select({
        totalAmount: sum(earnings.amount),
        count: count(),
      })
      .from(earnings)
      .where(
        and(eq(earnings.source, "app_fee"), eq(earnings.status, "completed"))
      );

    return {
      amount: Number(result[0]?.totalAmount) || 0,
      count: Number(result[0]?.count) || 0,
    };
  },
};
