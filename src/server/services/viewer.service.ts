import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { hasAnyRole } from "@/server/services/user.service";
import type { Viewer } from "@/server/services/shipment.service";

/**
 * Resolves the caller once, so routes can stay thin and hand a single object
 * to the service that enforces permissions (docs/rules.md §8).
 *
 * Roles are read per request rather than trusted from a session claim, so a
 * revoked role takes effect immediately (roles_spec.md edge case 5).
 */
export async function resolveViewer(): Promise<Viewer | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const userId = session.user.id;
  const [isAdmin, isOperator] = await Promise.all([
    hasAnyRole(userId, ["admin"]),
    hasAnyRole(userId, ["operator"]),
  ]);

  return { userId, isAdmin, isOperator };
}
