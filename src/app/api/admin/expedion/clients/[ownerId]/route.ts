import { headers } from "next/headers";

import { handleError, ok, unauthorised } from "@/lib/api-response";
import { auth } from "@/lib/auth";
import { expedionClientsService } from "@/server/services/expedion-clients.service";

/**
 * GET /api/admin/expedion/clients/[ownerId] — one client and their quotes.
 *
 * `ownerId` is `expedion_quotes.firebase_uid`, which means *owner* and not
 * necessarily anything Firebase — see `ExpedionCaller.userId` in
 * src/lib/expedion-auth.ts.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ownerId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const { ownerId } = await params;

    return ok(
      await expedionClientsService.getOne(
        session.user.id,
        decodeURIComponent(ownerId)
      )
    );
  } catch (error) {
    return handleError(error, "Expedion client");
  }
}
