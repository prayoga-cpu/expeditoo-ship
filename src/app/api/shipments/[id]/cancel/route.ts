import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { cancelShipmentSchema } from "@/server/dto/shipment.dto";
import {
  shipmentService,
  ShipmentNotFoundError,
  ShipmentAccessDeniedError,
  CannotCancelShipmentError,
} from "@/server/services/shipment.service";
import { hasRole } from "@/server/services/user.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/shipments/:id/cancel
 * Cancel a shipment
 */
export async function POST(req: Request, { params }: RouteParams) {
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

    const validation = cancelShipmentSchema.safeParse(body);

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

    // Check if user is admin
    const isAdmin = await hasRole(session.user.id, "admin");

    const shipment = await shipmentService.cancelShipment(
      id,
      session.user.id,
      validation.data.reason,
      isAdmin
    );

    return NextResponse.json({ success: true, data: shipment });
  } catch (error) {
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

    if (error instanceof CannotCancelShipmentError) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "CANNOT_CANCEL", message: error.message },
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
