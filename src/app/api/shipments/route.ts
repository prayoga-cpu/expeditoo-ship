import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  createShipmentSchema,
  getShipmentsQuerySchema,
  transformToInternalFormat,
} from "@/server/dto/shipment.dto";
import { shipmentService } from "@/server/services/shipment.service";

/**
 * GET /api/shipments
 * Get user's shipments (incoming/outgoing/driver)
 */
export async function GET(req: Request) {
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

    // Parse query params
    const { searchParams } = new URL(req.url);
    const queryParams = Object.fromEntries(searchParams.entries());

    const validation = getShipmentsQuerySchema.safeParse(queryParams);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid query parameters",
            details: validation.error.format(),
          },
        },
        { status: 400 }
      );
    }

    const result = await shipmentService.getUserShipments(
      session.user.id,
      validation.data
    );

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Get shipments error:", error);
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

/**
 * POST /api/shipments
 * Create a new shipment
 */
export async function POST(req: Request) {
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

    const body = await req.json();
    const validation = createShipmentSchema.safeParse(body);

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

    // Transform API format to internal format
    const internalData = transformToInternalFormat(validation.data);

    const shipment = await shipmentService.createShipment(
      session.user.id,
      internalData
    );

    return NextResponse.json(
      { success: true, data: shipment },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create shipment error:", error);
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
