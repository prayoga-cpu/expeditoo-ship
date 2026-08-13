import { listingsDal } from "@/server/dal/listings.dal";
import { resolveViewer } from "@/server/services/viewer.service";
import { browseListingsQuerySchema } from "@/server/dto/listings.dto";
import { ok, unauthorised, handleError, fail } from "@/lib/api-response";

/** GET /api/admin/listings — moderation view over the marketplace. */
export async function GET(req: Request) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();
    if (!viewer.isAdmin && !viewer.isOperator) {
      return fail("FORBIDDEN_ROLE", "Admin access required", 403);
    }

    const query = browseListingsQuerySchema.parse(
      Object.fromEntries(new URL(req.url).searchParams)
    );

    return ok(await listingsDal.browse(query));
  } catch (error) {
    return handleError(error, "Admin list listings");
  }
}
