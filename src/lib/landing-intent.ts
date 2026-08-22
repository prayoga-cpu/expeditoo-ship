/**
 * What a visitor was trying to do when they pressed something on the landing
 * page, and where that press should take them.
 *
 * Pure and total, so the whole redirect matrix is testable without a router or
 * a session. `docs/specs/landing_gated_actions_spec.md` §2 is the contract.
 */

export const LANDING_INTENTS = ["bid", "jobs", "carrier"] as const;

export type LandingIntent = (typeof LANDING_INTENTS)[number];

export interface LandingSession {
  /** A session exists right now. */
  isAuthenticated: boolean;
  /** A session has existed on this device before. */
  isReturning: boolean;
}

/** Where each intent goes once there is a session to go with it. */
const IN_APP_DESTINATION: Record<LandingIntent, string> = {
  bid: "/expedion",
  jobs: "/expedion",
  carrier: "/profile",
};

/**
 * A job reference and nothing else.
 *
 * The value reaches the auth pages through the query string, where anyone can
 * put anything, and is rendered into a notice sitting above a password field.
 * React escapes it, so this is not about markup — it is about denying an
 * attacker a paragraph of their own text on a credential-collecting page.
 */
const JOB_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9-]{0,23}$/;

export function isJobReference(value: unknown): value is string {
  return typeof value === "string" && JOB_REFERENCE.test(value);
}

export function isLandingIntent(value: unknown): value is LandingIntent {
  return (
    typeof value === "string" &&
    (LANDING_INTENTS as readonly string[]).includes(value)
  );
}

/**
 * A signed-in visitor never sees an auth page; a first-time device gets signup,
 * since there is nothing yet to log in to.
 */
export function resolveLandingDestination(
  intent: LandingIntent,
  session: LandingSession,
  ref?: string
): string {
  if (session.isAuthenticated) return IN_APP_DESTINATION[intent];

  const path = session.isReturning ? "/signin" : "/signup";
  const query = new URLSearchParams({ intent });
  if (ref) query.set("ref", ref);

  return `${path}?${query.toString()}`;
}
