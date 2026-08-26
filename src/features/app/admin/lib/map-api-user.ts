import { primaryRole } from "@/lib/primary-role";

import type { User } from "../types";

/**
 * The shape `/api/admin/users` returns for one user.
 */
export interface ApiUser {
  id: string;
  name?: string;
  email: string;
  roles?: string[];
  emailVerified?: boolean;
  banned?: boolean;
  createdAt?: string;
  lastLoginAt?: string | null;
  origin?: "expeditoo" | "expedion";
  impersonateBlocked?: string | null;
  deleteBlocked?: string | null;
  suspendBlocked?: string | null;
}

/**
 * Status, in precedence order.
 *
 * `banned` is checked first on purpose. Both admin tables used to derive this
 * from `emailVerified` alone, so a suspended user with a verified address --
 * which is every suspended user worth suspending -- displayed as "active".
 */
function status(user: ApiUser): User["status"] {
  if (user.banned) return "suspended";
  if (!user.emailVerified) return "pending";
  return "active";
}

/** One mapper for both the users table and the drivers table. */
export function mapApiUser(user: ApiUser): User {
  return {
    id: user.id,
    name: user.name || "Unknown",
    email: user.email,
    // Shared with the sidebar badge rather than ranked again here. The
    // local copy fell through to `roles[0]` for anything it did not name, and
    // that array's order is whatever the join returned — which is how a
    // support or finance account came to read "Shipper" in this table.
    role: primaryRole(user.roles ?? []),
    status: status(user),
    joinDate: user.createdAt
      ? new Date(user.createdAt).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
    lastLoginAt: user.lastLoginAt ?? null,
    origin: user.origin ?? "expeditoo",
    // Undefined means an endpoint that does not send these yet, which is not
    // the same as "refused" — leave the action enabled and let the server have
    // the last word, since it always does.
    impersonateBlocked: user.impersonateBlocked ?? null,
    deleteBlocked: user.deleteBlocked ?? null,
    suspendBlocked: user.suspendBlocked ?? null,
  };
}
