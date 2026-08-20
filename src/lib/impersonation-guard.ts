/**
 * Is this request riding an admin's borrowed session?
 *
 * Impersonation is for *looking*. A deliberate click an admin makes while
 * inside somebody's account is that user's action and is recorded as such
 * (docs/specs/admin_user_management_spec.md §3.5) -- but a write that fires
 * from a `useEffect` on page load is nobody's decision, and it mutates a real
 * user's data as a side effect of being looked at.
 *
 * Takes the already-resolved session rather than fetching its own, so a route
 * that has one pays nothing to ask.
 */
export function isImpersonated(
  session: { session?: { impersonatedBy?: string | null } | null } | null
): boolean {
  return Boolean(session?.session?.impersonatedBy);
}
