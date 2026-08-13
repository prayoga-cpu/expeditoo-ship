import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { invoicesService } from "@/server/services/invoices.service";
import { z } from "zod";

const querySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(20),
});

/**
 * GET /api/user/payments
 * Get payment history for the current user (with related invoices)
 */
export async function GET(request: Request) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session?.user?.id) {
            return NextResponse.json(
                {
                    success: false,
                    error: { code: "UNAUTHORIZED", message: "Unauthorized" },
                },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const queryResult = querySchema.safeParse({
            page: searchParams.get("page") || 1,
            limit: searchParams.get("limit") || 20,
        });

        if (!queryResult.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: "VALIDATION_ERROR",
                        message: "Invalid query parameters",
                        details: queryResult.error.flatten(),
                    },
                },
                { status: 400 }
            );
        }

        const { page, limit } = queryResult.data;

        const result = await invoicesService.getPaymentHistory(session.user.id, page, limit);

        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        console.error("Error fetching payment history:", error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Failed to fetch payment history",
                },
            },
            { status: 500 }
        );
    }
}
