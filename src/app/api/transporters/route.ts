import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { transportersService } from "@/server/services/transporters.service";
import { z } from "zod";

const querySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(20),
    minRating: z.coerce.number().min(0).max(5).optional(),
});

/**
 * GET /api/transporters
 * Get available transporters
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
            minRating: searchParams.get("minRating") || undefined,
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

        const result = await transportersService.getAvailableTransporters(queryResult.data);

        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        console.error("Error fetching transporters:", error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Failed to fetch transporters",
                },
            },
            { status: 500 }
        );
    }
}
