import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { invoicesService } from "@/server/services/invoices.service";
import { invoiceQuerySchema } from "@/server/dto/invoices.dto";

/**
 * GET /api/user/invoices
 * Get all invoices for the current user
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
        const queryResult = invoiceQuerySchema.safeParse({
            page: searchParams.get("page") || 1,
            limit: searchParams.get("limit") || 20,
            status: searchParams.get("status") || undefined,
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

        const result = await invoicesService.getUserInvoices(session.user.id, queryResult.data);

        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        console.error("Error fetching invoices:", error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Failed to fetch invoices",
                },
            },
            { status: 500 }
        );
    }
}
