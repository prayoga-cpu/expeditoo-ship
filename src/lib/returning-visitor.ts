/**
 * Whether this device has ever held a session.
 *
 * The landing page uses it to choose between login and signup for a signed-out
 * visitor: someone who has signed in here before has an account to return to,
 * a first-time visitor does not. Deliberately survives sign-out — that is the
 * whole point of the flag.
 *
 * It is a hint, never a permission: nothing is unlocked by it, so a cleared
 * store or a blocked one only costs the visitor a click.
 */

export const RETURNING_VISITOR_KEY = "expeditoo-returning";

/** Never throws: storage is unavailable in private modes and on the server. */
export function isReturningVisitor(): boolean {
  if (typeof window === "undefined") return false;

  try {
    return window.localStorage.getItem(RETURNING_VISITOR_KEY) === "1";
  } catch {
    return false;
  }
}

/** Called once a session exists, from anywhere in the app. */
export function markReturningVisitor(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(RETURNING_VISITOR_KEY, "1");
  } catch {
    // Storage disabled. The visitor simply keeps being offered signup.
  }
}
