import { headers } from "next/headers";

import { handleError, ok, unauthorised } from "@/lib/api-response";
import { auth } from "@/lib/auth";
import { expedionClientsService } from "@/server/services/expedion-clients.service";

/**
 * GET /api/admin/expedion/clients — Expedion's client book.
 *
 * An `/api/admin/*` route rather than `/api/expedion/*` on purpose: the
 * Expedion routes authorise a *client* and scope every list to its caller,
 * whereas this one is unscoped by design and must never be reachable by one.
 * The `admin` check itself lives in the service (docs/rules.md §3.4).
 */
export async function GET(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const params = new URL(req.url).searchParams;

    return ok(
      await expedionClientsService.list(session.user.id, {
        search: params.get("search") ?? undefined,
        linked: params.get("linked") ?? undefined,
        sortBy: params.get("sortBy") ?? undefined,
        sortOrder: params.get("sortOrder") ?? undefined,
        page: params.get("page") ?? undefined,
        pageSize: params.get("pageSize") ?? undefined,
      })
    );
  } catch (error) {
    return handleError(error, "Expedion clients");
  }
}
