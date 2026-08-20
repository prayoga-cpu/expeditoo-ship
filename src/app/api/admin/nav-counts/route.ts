import { adminNavService } from "@/server/services/admin-nav.service";
import { resolveViewer } from "@/server/services/viewer.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

/**
 * GET /api/admin/nav-counts — the badge on each sidebar entry.
 *
 * Called from every admin page and on a timer, so it is one round trip and
 * carries nothing but integers.
 */
export async function GET() {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();

    return ok(await adminNavService.counts(viewer));
  } catch (error) {
    return handleError(error, "Admin nav counts");
  }
}
