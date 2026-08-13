import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  shipmentService,
  ShipmentNotFoundError,
  ShipmentAccessDeniedError,
} from "@/server/services/shipment.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/shipments/:id
 * Get shipment detail
 */
export async function GET(req: Request, { params }: RouteParams) {
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

    const shipment = await shipmentService.getShipmentDetail(
      id,
      session.user.id
    );

    return NextResponse.json({ success: true, data: shipment });
  } catch (error) {
    console.error("Get shipment detail error:", error);

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
