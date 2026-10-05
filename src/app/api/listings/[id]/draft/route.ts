import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { listingsService } from "@/server/services/listings.service";
import { createListingSchema } from "@/server/dto/listings.dto";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * A request that has not gone live yet — a draft or a scheduled one — as its
 * author finishes it (docs/specs/draft_requests_spec.md). Someone else's is
 * not found; one already live is a 409, and the form hands over to its page.
 */

/** GET /api/listings/:id/draft — the request, everything included, to resume it. */
export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const { id } = await params;
    return ok(await listingsService.getDraft(session.user.id, id));
  } catch (error) {
    return handleError(error, "Get draft");
  }
}

/**
 * PUT /api/listings/:id/draft — saved again, scheduled, or published now. The
 * body is a whole request, so every rule a new one meets applies.
 */
export async function PUT(req: Request, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const { id } = await params;
    const data = createListingSchema.parse(await req.json());
    return ok(await listingsService.saveDraft(session.user.id, id, data));
  } catch (error) {
    return handleError(error, "Save draft");
  }
}

/** DELETE /api/listings/:id/draft — gone for good: nobody else has seen it. */
export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const { id } = await params;
    return ok(await listingsService.deleteDraft(session.user.id, id));
  } catch (error) {
    return handleError(error, "Delete draft");
  }
}
