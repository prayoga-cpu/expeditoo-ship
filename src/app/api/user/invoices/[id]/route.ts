import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { invoicesService } from "@/server/services/invoices.service";

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/user/invoices/[id]
 * Get a specific invoice by ID
 */
export async function GET(request: Request, { params }: RouteParams) {
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

        const { id } = await params;

        const invoice = await invoicesService.getById(id, session.user.id);

        if (!invoice) {
            return NextResponse.json(
                {
                    success: false,
                    error: { code: "NOT_FOUND", message: "Invoice not found" },
                },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, data: { invoice } });
    } catch (error) {
        console.error("Error fetching invoice:", error);

        if (error instanceof Error && error.message === "Unauthorized access to invoice") {
            return NextResponse.json(
                {
                    success: false,
                    error: { code: "FORBIDDEN", message: "Access denied" },
                },
                { status: 403 }
            );
        }

        return NextResponse.json(
            {
                success: false,
                error: {
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Failed to fetch invoice",
                },
            },
            { status: 500 }
        );
    }
}
