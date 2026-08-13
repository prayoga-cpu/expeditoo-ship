import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { assignDriverSchema } from "@/server/dto/shipment.dto";
import {
  shipmentService,
  ShipmentNotFoundError,
  ShipmentAccessDeniedError,
  InvalidStatusTransitionError,
} from "@/server/services/shipment.service";
import { hasRole } from "@/server/services/user.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/shipments/:id/assign
 * Assign a driver to shipment (ADMIN ONLY)
 * 
 * NOTE: This endpoint is for direct driver assignment without proposals.
 * The primary flow should use the proposal system via /select endpoint.
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
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

    const { id } = await params;
    const body = await req.json();

    const validation = assignDriverSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request data",
            details: validation.error.format(),
          },
        },
        { status: 400 }
      );
    }

    // Check if user is admin - REQUIRED
    const isAdmin = await hasRole(session.user.id, "admin");
    if (!isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "Only admin can assign drivers" },
        },
        { status: 403 }
      );
    }

    const shipment = await shipmentService.assignDriver(
      id,
      validation.data.driverId,
      validation.data.price,
      session.user.id,
      isAdmin
    );

    return NextResponse.json({ success: true, data: shipment });
  } catch (error) {
    console.error("Assign driver error:", error);

    if (error instanceof ShipmentNotFoundError) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: error.message },
        },
        { status: 404 }
      );
    }

    if (error instanceof ShipmentAccessDeniedError) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: error.message },
        },
        { status: 403 }
      );
    }

    if (error instanceof InvalidStatusTransitionError) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_STATUS", message: error.message },
        },
        { status: 400 }
      );
    }

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
