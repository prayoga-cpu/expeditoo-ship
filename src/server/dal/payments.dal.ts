import { db } from "@/db";
import { payments, type InsertPayment } from "@/db/schema/payments";
import { eq, desc, and, sql, inArray } from "drizzle-orm";

// ========================================
// Payment DAL Functions
// ========================================

export const paymentsDal = {
    /**
     * Card charges where money really moved, for the admin's Stripe check
     * (launch_readiness_spec.md §B.3). A `pi_mock_` row is a captured
     * payment with no money behind it, so it is counted apart.
     */
    async realChargeSummary() {
        const real = sql`${payments.stripePaymentIntentId} not like 'pi_mock_%'`;
        const [row] = await db
            .select({
                realCount: sql<number>`count(*) filter (where ${real})`.mapWith(Number),
                firstRealAt: sql<Date | null>`min(${payments.createdAt}) filter (where ${real})`.mapWith(
                    (v) => (v ? new Date(v) : null)
                ),
                lastRealAt: sql<Date | null>`max(${payments.createdAt}) filter (where ${real})`.mapWith(
                    (v) => (v ? new Date(v) : null)
                ),
                mockCount: sql<number>`count(*) filter (where not ${real})`.mapWith(Number),
            })
            .from(payments)
            .where(
                and(
                    eq(payments.source, "stripe"),
                    inArray(payments.status, ["captured", "refunded"])
                )
            );
        return row;
    },

    /**
     * Get payment by ID
     */
    async getById(id: string) {
        return db.query.payments.findFirst({
            where: eq(payments.id, id),
            with: {
                user: true,
                listing: true,
                shipment: true,
            },
        });
    },

    /**
     * Get payment by Stripe Payment Intent ID
     */
    async getByPaymentIntentId(paymentIntentId: string) {
        return db.query.payments.findFirst({
            where: eq(payments.stripePaymentIntentId, paymentIntentId),
            with: {
                user: true,
                listing: true,
            },
        });
    },

    /**
     * Get all payments for a user with pagination
     */
    async getByUserId(userId: string, page = 1, limit = 20) {
        const offset = (page - 1) * limit;

        const items = await db.query.payments.findMany({
            where: eq(payments.userId, userId),
            with: {
                listing: true,
                shipment: true,
            },
            orderBy: desc(payments.createdAt),
            limit,
            offset,
        });

        const [countResult] = await db
            .select({ count: sql<number>`count(*)` })
            .from(payments)
            .where(eq(payments.userId, userId));

        const total = Number(countResult?.count) || 0;

        return {
            items,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    },

    /**
     * Create a new payment record
     */
    async create(data: InsertPayment) {
        const [payment] = await db.insert(payments).values(data).returning();
        return payment;
    },

    /**
     * Update payment status
     */
    async updateStatus(id: string, status: "pending" | "captured" | "failed" | "refunded") {
        const [updated] = await db
            .update(payments)
            .set({
                status,
                updatedAt: new Date(),
            })
            .where(eq(payments.id, id))
            .returning();

        return updated;
    },

    /**
     * Update payment record
     */
    async update(id: string, data: Partial<InsertPayment>) {
        const [updated] = await db
            .update(payments)
            .set({
                ...data,
                updatedAt: new Date(),
            })
            .where(eq(payments.id, id))
            .returning();

        return updated;
    },

    /**
     * Get total payment stats for a user
     */
    async getUserStats(userId: string) {
        const [result] = await db
            .select({
                totalCount: sql<number>`count(*)`,
                totalAmount: sql<number>`coalesce(sum(amount), 0)`,
                successCount: sql<number>`count(*) filter (where status = 'succeeded')`,
                pendingCount: sql<number>`count(*) filter (where status = 'pending')`,
            })
            .from(payments)
            .where(eq(payments.userId, userId));

        return {
            totalCount: Number(result?.totalCount) || 0,
            totalAmount: Number(result?.totalAmount) || 0,
            successCount: Number(result?.successCount) || 0,
            pendingCount: Number(result?.pendingCount) || 0,
        };
    },
};
