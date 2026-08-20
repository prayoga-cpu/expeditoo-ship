import * as usersDAL from "@/server/dal/users.dal";
import * as impersonationDAL from "@/server/dal/impersonation.dal";
import {
  holdsAdmin,
  impersonationRefusal,
} from "@/server/services/account-policy";

/**
 * "Log in as this user."
 *
 * The session minting and the cookie swap belong to the auth layer
 * (src/lib/auth/impersonation.ts) -- only Better Auth can sign a session
 * cookie. Everything that decides *whether it may happen*, and the audit trail
 * that records it happened, lives here.
 */

export class ImpersonationError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "ImpersonationError";
  }
}

/** An impersonated session lasts an hour, then expires on its own. */
export const IMPERSONATION_DURATION_SECONDS = 60 * 60;

/**
 * Decide whether `adminId` may borrow `targetUserId`'s session, and return the
 * two accounts when they may. Throws `ImpersonationError` otherwise.
 *
 * The rules themselves live in account-policy.ts, because the users table has
 * to draw its menu from the same answer this endpoint enforces.
 * Impersonating from inside an impersonation is refused separately, at the
 * endpoint, where the current session is in scope.
 */
export async function assertCanImpersonate(
  adminId: string,
  targetUserId: string
) {
  const admin = await usersDAL.getUserById(adminId);

  if (!admin || !holdsAdmin(admin.roles)) {
    throw new ImpersonationError(
      "NOT_ADMIN",
      "Only an admin can log in as another user",
      403
    );
  }

  const target = await usersDAL.getUserById(targetUserId);

  if (!target) {
    throw new ImpersonationError("USER_NOT_FOUND", "User not found", 404);
  }

  const refusal = impersonationRefusal(adminId, target);

  if (refusal) {
    throw new ImpersonationError(
      refusal.code,
      refusal.message,
      refusal.status
    );
  }

  return { admin, target };
}

interface StartInput {
  adminId: string;
  adminEmail: string;
  targetUserId: string;
  targetEmail: string;
  sessionToken: string;
  expiresAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/** Write the audit row for an impersonation that has just begun. */
export async function recordStart(input: StartInput) {
  return impersonationDAL.recordStart(input);
}

/**
 * Close the audit row for a session that is ending.
 *
 * A missing row is not an error: the session cookie is the thing that decides
 * whether the admin gets back, and refusing to return them because the audit
 * write went missing would strand them in someone else's account.
 */
export async function recordEnd(sessionToken: string) {
  return impersonationDAL.recordEnd(sessionToken);
}

/** Recent impersonations, newest first. */
export async function listRecent(adminId: string, limit = 50) {
  const admin = await usersDAL.getUserById(adminId);

  if (!admin || !holdsAdmin(admin.roles)) {
    throw new ImpersonationError(
      "NOT_ADMIN",
      "Admin access required",
      403
    );
  }

  return impersonationDAL.listRecent(limit);
}
