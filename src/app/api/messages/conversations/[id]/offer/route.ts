import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { threadOffersService } from "@/server/services/thread-offers.service";
import { createThreadOfferSchema } from "@/server/dto/thread-offers.dto";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/messages/conversations/:id/offer
 *
 * Put a price on the table inside a thread. On a thread about an open job this
 * also mints a real bid through the offers engine, so the chat feeds the
 * reverse auction rather than shadowing it.
 *
 * No impersonation guard: this fires from a deliberate click, not a mount
 * effect. Only auto-firing writes are suppressed for a borrowed session.
 */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { id: conversationId } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const data = createThreadOfferSchema.parse(await req.json());
    const result = await threadOffersService.submit(
      session.user.id,
      conversationId,
      data,
      { name: session.user.name, image: session.user.image ?? null }
    );

    return ok(result, 201);
  } catch (error) {
    return handleError(error, "Submit thread offer");
  }
}
