import { auth } from "@/lib/auth";
import { db } from "@/db";
import { payments } from "@/db/schema/payments";
import { user } from "@/db/schema/users";
import { desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { hasRole } from "@/server/services/user.service";

export async function GET() {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) {
            return NextResponse.json(
                {
                    success: false,
                    error: { code: "UNAUTHORIZED", message: "Authentication required" },
                },
                { status: 401 }
            );
        }

        // Admin check using proper hasRole service
        const isAdmin = await hasRole(session.user.id, "admin");
        if (!isAdmin) {
            return NextResponse.json(
                {
                    success: false,
                    error: { code: "FORBIDDEN", message: "Admin access required" },
                },
                { status: 403 }
            );
        }

        // Fetch all payments with user info
        const allPayments = await db
            .select({
                id: payments.id,
                amount: payments.amount,
                currency: payments.currency,
                status: payments.status,
                stripePaymentIntentId: payments.stripePaymentIntentId,
                listingId: payments.listingId,
                createdAt: payments.createdAt,
                userId: payments.userId,
                userName: user.name,
                userEmail: user.email,
            })
            .from(payments)
            .leftJoin(user, eq(payments.userId, user.id))
            .orderBy(desc(payments.createdAt))
            .limit(100);

        return NextResponse.json({
            success: true,
            data: {
                items: allPayments,
                total: allPayments.length,
            },
        });
    } catch (error: unknown) {
        const message =
            error instanceof Error ? error.message : "Failed to fetch payments";
        return NextResponse.json(
            { success: false, error: { code: "INTERNAL_ERROR", message } },
            { status: 500 }
        );
    }
}
