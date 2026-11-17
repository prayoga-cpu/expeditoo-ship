/**
 * Roles this admin UI offers to add or remove.
 *
 * `driver` and `carrier` are two roles, not one person under two names
 * (driver_types_spec.md §1): `driver` is the **in-house Expeditoo driver** —
 * runs what Expeditoo assigns, bids on nothing, sees no money — and `carrier`
 * is the **outside driver** who bids and is paid. Granting either from the role
 * dialog goes through the carrier service, which creates or approves the file
 * that earns it, so the person lands in the Drivers list straight away.
 *
 * `shipper` is granted to every signup automatically (`assignDefaultRole`) and
 * gates nothing — there is no `assertRole(session, "shipper")` anywhere in the
 * service layer. It is left out of both lists: not offered to add (there is
 * nothing to grant) and not offered to remove (removing it changes nothing).
 */
export const MANAGEABLE_ROLES = [
  "driver",
  "carrier",
  "operator",
  "support",
  "finance",
  "admin",
] as const;

export type ManageableRole = (typeof MANAGEABLE_ROLES)[number];

/** The raw `user_roles` values a manageable chip stands for — one each. */
export function dbRolesFor(role: string): readonly string[] {
  return [role];
}

/** Which manageable chips an account's raw `roles` currently light up. */
export function chipsHeld(roles: readonly string[]): ManageableRole[] {
  return MANAGEABLE_ROLES.filter((chip) => roles.includes(chip));
}

/** The roles that open a driver file, and so come with one. */
export const DRIVER_FILE_ROLES: readonly ManageableRole[] = ["driver", "carrier"];
