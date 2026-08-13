import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  shipmentService,
  ShipmentNotFoundError,
  ShipmentAccessDeniedError,
  CannotUploadPODError,
} from "@/server/services/shipment.service";
import { storageService } from "@/server/services/storage.service";
import { imageService } from "@/server/services/image.service";
import { nanoid } from "nanoid";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/shipments/:id/proof-of-delivery
 * Upload proof of delivery image
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

    // Parse form data
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const markDelivered = formData.get("markDelivered") !== "false"; // Default true

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "BAD_REQUEST", message: "No file provided" },
        },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "BAD_REQUEST", message: "File must be an image" },
        },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "BAD_REQUEST", message: "File size must be less than 10MB" },
        },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Compress image
    const {
      buffer: compressedBuffer,
      mimeType,
      ext,
    } = await imageService.compress(buffer);

    // Generate unique filename for POD
    const fileName = `pod/${shipmentId}/${nanoid()}.${ext}`;

    // Upload to storage
    const proofUrl = await storageService.uploadImage(
      compressedBuffer,
      fileName,
      mimeType
    );

    // Update shipment with proof of delivery
    const shipment = await shipmentService.uploadProofOfDelivery(
      shipmentId,
      driverId,
      proofUrl,
      markDelivered
    );

    return NextResponse.json({
      success: true,
      data: {
        id: shipment.id,
        status: shipment.status,
        proofOfDeliveryUrl: shipment.proofOfDeliveryUrl,
        deliveredAt: shipment.deliveredAt,
      },
    });
  } catch (error) {
    console.error("Upload proof of delivery error:", error);

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

    if (error instanceof CannotUploadPODError) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "CANNOT_UPLOAD_POD", message: error.message },
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
