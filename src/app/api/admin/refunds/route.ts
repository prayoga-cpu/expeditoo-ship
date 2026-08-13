import { auth } from "@/lib/auth";
import { refundService } from "@/server/services/refund.service";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hasRole } from "@/server/services/user.service";

// ========================================
// DTO Schemas
// ========================================

const refundInputSchema = z.object({
    paymentId: z.string().min(1, "Payment ID is required"),
    reason: z
        .enum(["duplicate", "fraudulent", "requested_by_customer"])
        .optional(),
});

// ========================================
// POST /api/admin/refunds - Process a refund (Admin only)
// ========================================

export async function POST(req: Request) {
    try {
        // 1. Auth Check
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

        // 2. Admin Role Check using proper service
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

        // 3. Validate Input
        const body = await req.json();
        const validation = refundInputSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: "VALIDATION_ERROR",
                        message: "Invalid input",
                        details: validation.error.flatten().fieldErrors,
                    },
                },
                { status: 400 }
            );
        }

        // 4. Process Refund via Service
        const { paymentId, reason } = validation.data;
        const refund = await refundService.processRefund(paymentId, reason);

        // 5. Success Response
        return NextResponse.json({
            success: true,
            data: { refund },
            message: "Refund processed successfully",
        });
    } catch (error: unknown) {
        const message =
            error instanceof Error ? error.message : "Failed to process refund";

        // Map known errors to specific codes
        let code = "INTERNAL_ERROR";
        let status = 500;

        if (message.includes("not found")) {
            code = "NOT_FOUND";
            status = 404;
        } else if (message.includes("already refunded")) {
            code = "ALREADY_REFUNDED";
            status = 400;
        }

        return NextResponse.json(
            { success: false, error: { code, message } },
            { status }
        );
    }
}
