import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { OfferError } from "@/server/services/offers.service";
import { ListingError } from "@/server/services/listings.service";
import { ShipmentError } from "@/server/services/shipment.service";
import { PaymentError } from "@/server/services/payments.service";
import { ConfirmationError } from "@/server/services/shipment-confirmations.service";
import { CarrierError } from "@/server/services/carrier.service";
import { CarrierRouteError } from "@/server/services/carrier-routes.service";
import { CarrierDiscoveryError } from "@/server/services/carrier-discovery.service";
import { EarningsError } from "@/server/services/earnings.service";
import { WithdrawalError } from "@/server/services/withdrawals.service";
import { InvoiceError } from "@/server/services/invoices.service";
import { ReviewError } from "@/server/services/reviews.service";
import { AdminError } from "@/server/services/admin.service";
import { ContactError } from "@/server/services/contact.service";
import { ExpedionClientError } from "@/server/services/expedion-clients.service";
import { ThreadOfferError } from "@/server/services/thread-offers.service";
import { FeedbackError } from "@/server/services/feedback.service";

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
    // Untranslated until 2026-08-29, so every payment failure on an accept
    // reached the client as a bare 500 and `useJobDetail`'s
    // PAYMENT_METHOD_REQUIRED branch could never fire.
    error instanceof PaymentError ||
    error instanceof ConfirmationError ||
    error instanceof CarrierError ||
    error instanceof CarrierRouteError ||
    error instanceof CarrierDiscoveryError ||
    error instanceof EarningsError ||
    error instanceof WithdrawalError ||
    error instanceof InvoiceError ||
    error instanceof ReviewError ||
    error instanceof AdminError ||
    error instanceof ContactError ||
    error instanceof ExpedionClientError ||
    error instanceof ThreadOfferError ||
    // Stripe refusing a request is a 4xx of Stripe's, not this server falling
    // over: untranslated, the payout onboarding call answered 500 and the
    // button had nothing to say.
    error instanceof FeedbackError
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
