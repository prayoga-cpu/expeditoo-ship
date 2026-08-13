import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  shipmentService,
  ShipmentNotFoundError,
  ProposalNotFoundError,
  InvalidStatusTransitionError,
} from "@/server/services/shipment.service";
import { hasRole } from "@/server/services/user.service";

interface RouteParams {
  params: Promise<{ id: string; proposalId: string }>;
}

/**
 * POST /api/shipments/:id/proposals/:proposalId/select
 * ADMIN ONLY - selects a proposal (assigns driver to shipment)
 * Per docs/overview.md: "Admin/Operator selects the best proposal"
 * 
 * All business logic (notifications, order updates) is handled in the service layer.
 */
export async function POST(req: Request, { params }: RouteParams) {
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

    const { proposalId } = await params;

    // Check if user is admin - REQUIRED
    const isAdmin = await hasRole(session.user.id, "admin");
    if (!isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "Only admin can accept proposals" },
        },
        { status: 403 }
      );
    }

    // Accept proposal - service handles all business logic:
    // - Update shipment status
    // - Update order with shipping price
    // - Record event
    // - Notify driver, buyer, seller
    const shipment = await shipmentService.acceptProposal(
      proposalId,
      session.user.id
    );

    return NextResponse.json({
      success: true,
      data: shipment,
      message: "Driver selected successfully",
    });
  } catch (error) {
    console.error("Select proposal error:", error);

    if (error instanceof ProposalNotFoundError) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: error.message },
        },
        { status: 404 }
      );
    }

    if (error instanceof ShipmentNotFoundError) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: error.message },
        },
        { status: 404 }
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
