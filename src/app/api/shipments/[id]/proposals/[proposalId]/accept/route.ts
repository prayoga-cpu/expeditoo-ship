import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  shipmentService,
  ShipmentNotFoundError,
  ShipmentAccessDeniedError,
  InvalidStatusTransitionError,
  ProposalNotFoundError,
} from "@/server/services/shipment.service";

interface RouteParams {
  params: Promise<{ id: string; proposalId: string }>;
}

/**
 * POST /api/shipments/:id/proposals/:proposalId/accept
 * Accept a proposal (user accepts driver's price)
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
    const userId = session.user.id;

    // Accept proposal
    const shipment = await shipmentService.acceptProposal(proposalId, userId);

    return NextResponse.json({
      success: true,
      data: shipment,
    });
  } catch (error) {
    console.error("Accept proposal error:", error);

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
          message: error instanceof Error ? error.message : "Internal server error",
        },
      },
      { status: 500 }
    );
  }
}
