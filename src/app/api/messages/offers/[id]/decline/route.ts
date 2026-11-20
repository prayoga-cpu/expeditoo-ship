import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { isImpersonated } from "@/lib/impersonation-guard";
import { threadOffersService } from "@/server/services/thread-offers.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** POST /api/messages/offers/:id/decline */
export async function POST(_req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    // An admin inside the account may decline for the user, but the sender is
    // not pinged by someone who is only looking (thread_offer_spec.md §13).
    const result = await threadOffersService.decline(session.user.id, id, {
      notify: !isImpersonated(session),
    });
    return ok(result);
  } catch (error) {
    return handleError(error, "Decline thread offer");
  }
}
