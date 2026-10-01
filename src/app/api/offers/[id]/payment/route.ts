import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { offersService } from "@/server/services/offers.service";
import {
  paymentQuoteQuerySchema,
  preparePaymentSchema,
} from "@/server/dto/offers.dto";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/offers/:id/payment
 *
 * What accepting this offer would debit now, and with which saved card. Read
 * when the payment dialog opens, so it writes nothing — not even a Stripe
 * customer (docs/specs/pay_at_accept_spec.md §3.1).
 */
export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { id: offerId } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const { slotId } = paymentQuoteQuerySchema.parse(
      Object.fromEntries(new URL(req.url).searchParams)
    );

    const quote = await offersService.paymentQuote(
      session.user.id,
      offerId,
      slotId
    );
    return ok(quote);
  } catch (error) {
    return handleError(error, "Offer payment quote");
  }
}

/**
 * POST /api/offers/:id/payment
 *
 * Authorises the requester's card for this award — the saved one, or a new
 * one through the returned client secret. The accept that follows captures it
 * (docs/specs/pay_at_accept_spec.md §3.2).
 */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { id: offerId } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const input = preparePaymentSchema.parse(await req.json());

    const result = await offersService.preparePayment(
      session.user.id,
      offerId,
      input
    );
    return ok(result, 201);
  } catch (error) {
    return handleError(error, "Prepare offer payment");
  }
}
