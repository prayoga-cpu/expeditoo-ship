import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { shipments } from "@/db/schema/shipments";
import { desc } from "drizzle-orm";
import { hasRole } from "@/server/services/user.service";

/**
 * GET /api/admin/shipments
 * Get ALL shipments (admin only)
 */
export async function GET(_req: Request) {
    try {
        // Check authentication
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session) {
            return NextResponse.json(
                {
                    success: false,
                    error: { code: "UNAUTHORIZED", message: "Unauthorized" },
                },
                { status: 401 }
            );
        }

        // Check if user is admin
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

        // Fetch all shipments with relations
        const allShipments = await db.query.shipments.findMany({
            orderBy: [desc(shipments.createdAt)],
            with: {
                shipper: {
                    columns: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                driver: {
                    columns: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                listing: {
                    columns: {
                        title: true,
                    },
                },
                offer: {
                    columns: {
                        id: true,
                        priceCents: true,
                    },
                },
            },
        });

        return NextResponse.json({
            success: true,
            data: allShipments,
        });
    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: "INTERNAL_SERVER_ERROR",
                    message:
                        error instanceof Error ? error.message : "Internal server error",
                },
            },
            { status: 500 }
        );
    }
}
