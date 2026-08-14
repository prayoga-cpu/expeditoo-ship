import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { OfferError } from "@/server/services/offers.service";
import { ListingError } from "@/server/services/listings.service";
import { ShipmentError } from "@/server/services/shipment.service";
import { CarrierError } from "@/server/services/carrier.service";
import { ReviewError } from "@/server/services/reviews.service";

/**
 * Shared response shape for the REST layer.
 *
 * Routes stay thin (docs/rules.md §3.4) by delegating error translation here,
 * so a service's error codes are mapped in one place rather than re-derived in
 * each of the route handlers.
 */

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function fail(code: string, message: string, status: number) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status }
  );
}

export const unauthorised = () =>
  fail("UNAUTHENTICATED", "Authentication required", 401);

export function handleError(error: unknown, context: string) {
  if (
    error instanceof OfferError ||
    error instanceof ListingError ||
    error instanceof ShipmentError ||
    error instanceof CarrierError ||
    error instanceof ReviewError
  ) {
    return fail(error.code, error.message, error.status);
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid input",
          issues: error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
      },
      { status: 400 }
    );
  }

  console.error(`${context}:`, error);
  return fail("INTERNAL_ERROR", "Something went wrong", 500);
}
