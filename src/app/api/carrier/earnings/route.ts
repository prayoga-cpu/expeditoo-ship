import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  earningsService,
  earningsQuerySchema,
} from "@/server/services/earnings.service";
import { ok, unauthorised, handleError } from "@/lib/api-response";

/**
 * GET /api/carrier/earnings
 * What the caller earned on the deliveries they carried out.
 *
 * Gated on holding a carrier record, not on the `driver` role: prices are
 * redacted from drivers everywhere else (roles_spec.md §3) and this route makes
 * no exception.
 */
export async function GET(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const query = earningsQuerySchema.parse(
      Object.fromEntries(new URL(req.url).searchParams)
    );

    return ok(await earningsService.getForCarrier(session.user.id, query));
  } catch (error) {
    return handleError(error, "Carrier earnings");
  }
}
