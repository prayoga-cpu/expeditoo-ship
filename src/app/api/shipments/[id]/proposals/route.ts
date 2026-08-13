import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  shipmentService,
  ShipmentNotFoundError,
  ShipmentAccessDeniedError,
  InvalidStatusTransitionError,
  ProposalAlreadyExistsError,
} from "@/server/services/shipment.service";
import { createProposalSchema } from "@/server/dto/shipment.dto";
import { hasRole } from "@/server/services/user.service";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/shipments/:id/proposals
 * Get all proposals for a shipment (only shipment owner can see)
 */
export async function GET(req: Request, { params }: RouteParams) {
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

    const { id: shipmentId } = await params;
    const userId = session.user.id;

    // Check if user is admin
    const isAdmin = await hasRole(userId, "admin");

    // Get proposals
    const proposals = await shipmentService.getProposals(
      shipmentId,
      userId,
      isAdmin
    );

    return NextResponse.json({
      success: true,
      data: proposals,
    });
  } catch (error) {
    console.error("Get proposals error:", error);

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
          message: error instanceof Error ? error.message : "Internal server error",
        },
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/shipments/:id/proposals
 * Submit a proposal (driver submits price)
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

    const { id: shipmentId } = await params;
    const driverId = session.user.id;

    // Parse and validate body
    const body = await req.json();
    const validatedData = createProposalSchema.parse(body);

    // Create proposal
    const proposal = await shipmentService.createProposal(
      shipmentId,
      driverId,
      validatedData
    );

    return NextResponse.json({
      success: true,
      data: proposal,
    });
  } catch (error) {
    console.error("Create proposal error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request body",
            details: error.errors,
          },
        },
        { status: 400 }
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

    if (error instanceof ProposalAlreadyExistsError) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "ALREADY_EXISTS", message: error.message },
        },
        { status: 409 }
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
