import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ExpedionAuthError } from "@/lib/expedion-auth";
import { ExpedionError } from "@/server/services/expedion.service";
import { ConfirmationError } from "@/server/services/shipment-confirmations.service";
import { ShipmentError } from "@/server/services/shipment-access";

/**
 * Maps the Expedion bridge's error types onto the platform's response
 * envelope. Anything unrecognised becomes a 500 and is logged rather than
 * leaked, so an internal message never reaches the Flutter client.
 */
export function expedionErrorResponse(error: unknown) {
  if (
    error instanceof ExpedionAuthError ||
    error instanceof ExpedionError ||
    error instanceof ConfirmationError ||
    // Shipment photos are read over this bridge too (§7.3), so a
    // `PHOTO_NOT_FOUND` must not surface to the Flutter client as a 500.
    error instanceof ShipmentError
  ) {
    return NextResponse.json(
      { success: false, error: { code: error.code, message: error.message } },
      { status: error.status }
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request data",
          details: error.format(),
        },
      },
      { status: 400 }
    );
  }

  console.error("[expedion] unhandled error", error);
  return NextResponse.json(
    {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
    },
    { status: 500 }
  );
}
