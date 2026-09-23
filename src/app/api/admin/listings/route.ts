import { listingsService } from "@/server/services/listings.service";
import { resolveViewer } from "@/server/services/viewer.service";
import { adminListingsQuerySchema } from "@/server/dto/listings.dto";
import { ok, unauthorised, handleError } from "@/lib/api-response";

/** GET /api/admin/listings — moderation view over every job, any status. */
export async function GET(req: Request) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();

    const query = adminListingsQuerySchema.parse(
      Object.fromEntries(new URL(req.url).searchParams)
    );

    return ok(await listingsService.adminList(viewer, query));
  } catch (error) {
    return handleError(error, "Admin list listings");
  }
}
