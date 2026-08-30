import { auth } from "@/lib/auth";
import { headers } from "next/headers";
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

    const result = await threadOffersService.decline(session.user.id, id);
    return ok(result);
  } catch (error) {
    return handleError(error, "Decline thread offer");
  }
}
