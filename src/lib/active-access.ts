/**
 * Which access a signed-in account is currently browsing with.
 *
 * A hint, never a permission — the same contract as returning-visitor.ts.
 * Nothing here is checked by a service; every real permission check still
 * lives in auth.service.ts and reads the account's actual roles. Clearing
 * the stored value, or a private window that never persists it, just costs
 * the visitor a click to switch back — it never unlocks or locks anything.
 */

export type AccessMode = "user" | "carrier" | "admin";

export const ACTIVE_ACCESS_KEY = "expeditoo-active-access";

/** Roles that qualify an account for each mode beyond the universal `user`. */
const CARRIER_ROLES = ["carrier", "driver"];
const ADMIN_ROLES = ["admin", "operator", "support", "finance"];

const ALL_MODES: readonly AccessMode[] = ["admin", "carrier", "user"];

function isAccessMode(value: string): value is AccessMode {
  return (ALL_MODES as readonly string[]).includes(value);
}

/**
 * Which modes this set of roles qualifies for, most-privileged first.
 *
 * `user` is always included — `shipper` is granted to every signup, so there
 * is always somewhere to fall back to.
 */
export function qualifiedAccessModes(
  roles: readonly string[]
): AccessMode[] {
  const modes: AccessMode[] = [];
  if (roles.some((role) => ADMIN_ROLES.includes(role))) modes.push("admin");
  if (roles.some((role) => CARRIER_ROLES.includes(role))) modes.push("carrier");
  modes.push("user");
  return modes;
}

/**
 * The mode to actually show: the stored preference if the account still
 * qualifies for it, otherwise the strongest mode it does qualify for.
 *
 * A role revoked since the preference was stored (or a preference from
 * before this account held anything beyond `shipper`) never leaves the UI
 * stuck offering an access the session no longer has.
 */
export function resolveAccessMode(
  roles: readonly string[],
  stored: AccessMode | null
): AccessMode {
  const qualified = qualifiedAccessModes(roles);
  if (stored && qualified.includes(stored)) return stored;
  return qualified[0];
}

/** Never throws: storage is unavailable in private modes and on the server. */
export function getStoredAccessMode(): AccessMode | null {
  if (typeof window === "undefined") return null;

  try {
    const value = window.localStorage.getItem(ACTIVE_ACCESS_KEY);
    return value && isAccessMode(value) ? value : null;
  } catch {
    return null;
  }
}

/** Called whenever the switcher, or onboarding, picks a mode. */
export function setStoredAccessMode(mode: AccessMode): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(ACTIVE_ACCESS_KEY, mode);
  } catch {
    // Storage disabled. The choice just stops surviving a refresh;
    // resolveAccessMode still has a sane fallback every time.
  }
}
