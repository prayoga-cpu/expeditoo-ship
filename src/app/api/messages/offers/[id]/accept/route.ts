import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { threadOffersService } from "@/server/services/thread-offers.service";
import { acceptThreadOfferSchema } from "@/server/dto/thread-offers.dto";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** POST /api/messages/offers/:id/accept */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    // The body is optional: a standalone offer moves no money, and until the
    // payment dialog this was posted with no body at all.
    const { paymentIntentId } = acceptThreadOfferSchema.parse(
      await req.json().catch(() => ({}))
    );

    const result = await threadOffersService.accept(session.user.id, id, {
      paymentIntentId,
    });
    return ok(result);
  } catch (error) {
    return handleError(error, "Accept thread offer");
  }
}
