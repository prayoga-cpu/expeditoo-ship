import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { userContactService } from "@/server/services/user-contact.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

/**
 * GET /api/users/me/contact — the caller's names and phones
 * (client_feedback_2026_10_spec.md §7b). Owner only: the session is the key.
 */
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    return ok(await userContactService.getOwn(session.user.id));
  } catch (error) {
    return handleError(error, "Get contact details");
  }
}

/** PUT /api/users/me/contact — saves them; `""` clears a field. */
export async function PUT(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const body = await req.json().catch(() => ({}));
    return ok(await userContactService.updateOwn(session.user.id, body));
  } catch (error) {
    return handleError(error, "Update contact details");
  }
}
