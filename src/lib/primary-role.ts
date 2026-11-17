import { userRoleEnum, type UserRoleEnum } from "@/db/schema/users";

/**
 * The one role a surface shows when a person holds several.
 *
 * `user_roles` is many-to-many and most accounts hold more than one — every
 * signup is granted `shipper`, so an operator is an operator *and* a shipper.
 * Two screens picking their own answer to "which one do we print" is how the
 * admin table came to read "Shipper" for staff: it took `roles[0]`, and the
 * order that array arrives in is whatever the join returned.
 *
 * Ordered most-privileged first, so the label names the strongest access the
 * account actually has. `carrier` (the outside driver who bids and is paid)
 * outranks `driver` (the in-house Expeditoo driver, who sees no money); they
 * are two roles, not one person under two names (driver_types_spec.md §1).
 */
const PRECEDENCE = [
  "admin",
  "finance",
  "support",
  "operator",
  "carrier",
  "driver",
  "shipper",
] as const satisfies readonly UserRoleEnum[];

/**
 * What an account with no row in `user_roles` reads as. Not a role — there is
 * no such value in `userRoleEnum` — which is the point: it says "signed in,
 * granted nothing" rather than inventing an access level.
 */
export const NO_ROLE_LABEL = "user";

export type PrimaryRole = UserRoleEnum | typeof NO_ROLE_LABEL;

/** Every value in `userRoleEnum`, ranked. Asserted in the tests, not by eye. */
export const ROLE_PRECEDENCE: readonly UserRoleEnum[] = PRECEDENCE;

/** The canonical enum, re-exported so callers never restate the seven names. */
export const ALL_ROLES: readonly UserRoleEnum[] = userRoleEnum.enumValues;

/**
 * The strongest role held, or `user` when none is.
 */
export function primaryRole(roles: readonly string[]): PrimaryRole {
  return PRECEDENCE.find((role) => roles.includes(role)) ?? NO_ROLE_LABEL;
}
