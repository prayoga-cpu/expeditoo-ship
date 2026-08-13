import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { listingsService } from "@/server/services/listings.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

/** GET /api/users/me/listings — alias of /api/listings/me. */
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    return ok(await listingsService.getMyListings(session.user.id));
  } catch (error) {
    return handleError(error, "Get my listings");
  }
}
