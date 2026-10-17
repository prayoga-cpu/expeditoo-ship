import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { companyIdentityService } from "@/server/services/company-identity.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

/**
 * GET/PUT /api/admin/company
 *
 * The company's legal identity, printed on payment documents and on the
 * mentions légales (launch_readiness_spec.md §A). Admin or finance only — the
 * check lives in the service.
 */
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    return ok(await companyIdentityService.getForAdmin(session.user.id));
  } catch (error) {
    return handleError(error, "Get company identity");
  }
}

export async function PUT(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const body = await req.json();
    return ok(await companyIdentityService.update(session.user.id, body));
  } catch (error) {
    return handleError(error, "Update company identity");
  }
}
