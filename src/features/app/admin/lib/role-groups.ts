/**
 * Roles this admin UI offers to add or remove.
 *
 * `carrier` and `driver` are granted together and only together — KYC
 * approval assigns both in the same call (`carrier.service.ts`) — and mean
 * one person in this product, not a company and its employees: see
 * CLAUDE.md "Data Model" and `src/lib/primary-role.ts`, which already
 * collapses the pair to a single "driver" label for the sidebar badge (the
 * French copy for both is literally the same word, "Chauffeur"). Offering
 * them as two separate chips here let an admin grant one without the other,
 * a state the rest of the app never produces and dashboard counts
 * (`admin.dal.ts` `getActiveDriversCount`) don't expect.
 *
 * `shipper` is granted to every signup automatically
 * (`assignDefaultRole`) and gates nothing — there is no
 * `assertRole(session, "shipper")` anywhere in the service layer, and no
 * shipper-facing surface exists to gate. It is left out of both lists: not
 * offered to add (there is nothing to grant) and not offered to remove
 * (there is nothing removing it would change).
 */
export const DRIVER_ROLE_GROUP = ["carrier", "driver"] as const;

export const MANAGEABLE_ROLES = [
  "driver",
  "operator",
  "support",
  "finance",
  "admin",
] as const;

export type ManageableRole = (typeof MANAGEABLE_ROLES)[number];

/** The raw `user_roles` values a manageable chip stands for. */
export function dbRolesFor(role: string): readonly string[] {
  return role === "driver" ? DRIVER_ROLE_GROUP : [role];
}

/** Which manageable chips an account's raw `roles` currently light up. */
export function chipsHeld(roles: readonly string[]): ManageableRole[] {
  return MANAGEABLE_ROLES.filter((chip) =>
    dbRolesFor(chip).some((dbRole) => roles.includes(dbRole))
  );
}
