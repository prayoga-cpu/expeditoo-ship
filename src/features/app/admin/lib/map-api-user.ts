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
 * The role shown in the table: the most privileged one the user holds, since
 * a driver who is also an operator should not read as "User".
 */
function primaryRole(roles: string[]): string {
  if (roles.includes("admin")) return "admin";
  if (roles.includes("operator")) return "operator";
  if (roles.includes("driver") || roles.includes("carrier")) return "driver";
  return roles[0] ?? "user";
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
