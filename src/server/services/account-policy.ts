/**
 * Who may be impersonated, and who may be deleted.
 *
 * One module rather than a copy in each service, because the admin table has
 * to offer exactly what the server will accept. When the rules lived only
 * inside the two services, the users page happily offered "Log in as user" on
 * an admin row and the request came back 403 -- the policy has to be readable
 * by the screen that draws the menu, not just by the endpoint that refuses it.
 */

export interface Refusal {
  code: string;
  message: string;
  status: number;
}

interface Account {
  id: string;
  roles: readonly { role: string }[];
}

export function holdsAdmin(roles: readonly { role: string }[]): boolean {
  return roles.some((r) => r.role === "admin");
}

/**
 * The account that owns every escalated listing (`EXPEDION_SYSTEM_USER_ID`).
 * Nobody signs in as it, and everything on the Expedion inlet hangs off it.
 */
export function isSystemAccount(userId: string): boolean {
  const systemId = process.env.EXPEDION_SYSTEM_USER_ID;
  return Boolean(systemId) && userId === systemId;
}

/**
 * Why `actorId` may not borrow `target`'s session, or null when they may.
 *
 * Only self is refused, and only because it means nothing: you are already
 * signed in as yourself.
 *
 * An earlier version also refused other admins and the system account, so that
 * one compromised admin account could not become every admin account. That
 * risk is real, and the product decision is nonetheless to allow it: an admin
 * has to be able to see any account. What keeps it accountable is the audit
 * trail rather than a list of exceptions — the capability is admin-only, every
 * use writes an `impersonation_sessions` row naming who did it to whom and
 * from where, and the borrowed session expires after an hour.
 */
export function impersonationRefusal(
  actorId: string,
  target: Account
): Refusal | null {
  if (actorId === target.id) {
    return {
      code: "CANNOT_IMPERSONATE_SELF",
      message: "You are already signed in as yourself",
      status: 400,
    };
  }

  return null;
}

/**
 * Why `actorId` may not suspend `target`, or null when they may.
 *
 * Only self is refused: suspending another admin is a legitimate act, and the
 * one account that must never be locked out is the one doing the locking.
 */
export function suspensionRefusal(
  actorId: string,
  target: Account
): Refusal | null {
  if (actorId === target.id) {
    return {
      code: "SELF_BAN_NOT_ALLOWED",
      message: "You cannot suspend your own account",
      status: 400,
    };
  }

  return null;
}

/** Why `actorId` may not delete `target`, or null when they may. */
export function deletionRefusal(
  actorId: string,
  target: Account
): Refusal | null {
  if (actorId === target.id) {
    return {
      code: "SELF_DELETE_NOT_ALLOWED",
      message: "You cannot delete your own account",
      status: 400,
    };
  }

  if (holdsAdmin(target.roles)) {
    return {
      code: "CANNOT_DELETE_ADMIN",
      message: "Admin accounts cannot be deleted from here",
      status: 403,
    };
  }

  if (isSystemAccount(target.id)) {
    return {
      code: "CANNOT_DELETE_SYSTEM_USER",
      message: "The Expedion system account cannot be deleted",
      status: 403,
    };
  }

  return null;
}
