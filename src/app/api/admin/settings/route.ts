import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { platformSettingsService } from "@/server/services/platform-settings.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

/**
 * GET/PATCH /api/admin/settings
 *
 * The platform fee rate. The permission check (admin or finance) lives in
 * the service, same as every other admin surface here.
 */
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    return ok(await platformSettingsService.getForAdmin(session.user.id));
  } catch (error) {
    return handleError(error, "Get platform settings");
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const body = await req.json();
    return ok(await platformSettingsService.update(session.user.id, body));
  } catch (error) {
    return handleError(error, "Update platform settings");
  }
}
