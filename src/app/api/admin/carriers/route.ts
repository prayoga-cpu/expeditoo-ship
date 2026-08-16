import { carrierService } from "@/server/services/carrier.service";
import { resolveViewer } from "@/server/services/viewer.service";
import { ok, unauthorised, handleError, fail } from "@/lib/api-response";

/**
 * GET /api/admin/carriers — the pool an operator may assign a job to.
 *
 * Only `approved` carriers qualify: the earlier statuses have not cleared KYC,
 * and suspension exists precisely to stop new work reaching a carrier
 * (carrier_kyc_spec.md §2).
 *
 * Admin only, like the suspend route beside it and the Expedion report this
 * picker sits on top of — an operator who cannot load the dashboard has no
 * reason to be able to enumerate carriers through it.
 */
export async function GET() {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();
    if (!viewer.isAdmin) return fail("FORBIDDEN_ROLE", "Admin only", 403);

    const carriers = await carrierService.listForReview("approved");

    // `listByStatus` eagerly loads documents, vehicles and the owner's user
    // row for the review screen. A picker needs a label and an id, and KYC
    // document metadata has no business in that payload. Ordering is added
    // here because the DAL returns rows in whatever order Postgres gives them,
    // which would shuffle the dropdown between loads.
    return ok(
      carriers
        .map(({ id, companyName }) => ({ id, companyName }))
        .sort((a, b) => a.companyName.localeCompare(b.companyName))
    );
  } catch (error) {
    return handleError(error, "List assignable carriers");
  }
}
