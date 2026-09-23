import { z } from "zod";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { listingsService } from "@/server/services/listings.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";
import { listingStatusEnum } from "@/db/schema/listings";

const querySchema = z.object({
  status: z.enum(listingStatusEnum.enumValues).optional(),
});

/** GET /api/listings/me — the caller's own jobs, any status. */
export async function GET(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const { status } = querySchema.parse(
      Object.fromEntries(new URL(req.url).searchParams)
    );

    return ok(await listingsService.getMyListings(session.user.id, status));
  } catch (error) {
    return handleError(error, "Get my listings");
  }
}
