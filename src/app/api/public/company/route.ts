import { companyIdentityService } from "@/server/services/company-identity.service";
import { handleError, ok } from "@/lib/api-response";

/**
 * GET /api/public/company
 *
 * The publisher's identity for the mentions légales page. Public and
 * unauthenticated: French law requires these details to be published, so
 * nothing here is private. The VAT rate and billing address are not part of
 * it (launch_readiness_spec.md §A.4).
 *
 * Dynamic, because an admin edits it at /admin/settings and the page should
 * show the change without a deploy.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok(await companyIdentityService.getPublic());
  } catch (error) {
    return handleError(error, "Public company identity");
  }
}
