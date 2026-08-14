/**
 * Authenticating the Expedion Flutter client.
 *
 * Expedion now signs in through this app's own Better Auth (its Flutter client
 * uses the `bearer` plugin, so the session token rides in `Authorization:
 * Bearer …` instead of a cookie). That is the primary path: the caller is a
 * real user, identified by their Better Auth user id, and "is this person an
 * admin" is answered by the same `admin` role the web app uses — not by which
 * shared secret they happened to present.
 *
 * The older shared-key path is kept as a fallback for two callers that have no
 * user session of their own:
 *
 *   - Firebase-era clients still in the field, which authenticate as the *app*
 *     with `EXPEDION_API_KEY` and name the Firebase UID they act for in
 *     `x-expedion-uid`.
 *   - Server-to-server automation (repricing, forced escalation, write-back),
 *     which uses the separate `EXPEDION_ADMIN_API_KEY`.
 *
 * The trust model of that fallback has not improved and is worth restating:
 * the client key authenticates the app, not the end user, so any holder can
 * claim any UID. It must never be compiled into a browser bundle. The Better
 * Auth path has no such property — a session token is the user — which is why
 * it is tried first and why the web build should carry no key at all.
 */

import { auth } from "@/lib/auth";
import * as usersDAL from "@/server/dal/users.dal";

export interface ExpedionCaller {
  /**
   * Stable owner id for the caller's quotes. A Better Auth user id on the
   * session path, or the presented Firebase UID on the legacy key path.
   *
   * Stored in `expedion_quotes.firebase_uid`, whose name predates this and now
   * means "owner", not "Firebase". Renaming the column is a migration; the
   * meaning is recorded here instead.
   */
  userId: string;
  isAdmin: boolean;

  /** Which path authenticated this caller, for logging and for tests. */
  via: "session" | "client-key" | "admin-key";
}

export class ExpedionAuthError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message?: string
  ) {
    super(message ?? code);
    this.name = "ExpedionAuthError";
  }
}

function bearer(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

/**
 * Constant-time compare, so a wrong key cannot be recovered by timing the
 * response. Length is compared first and leaks only the length.
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Resolves a Better Auth session from the request, if there is one.
 *
 * Returns null rather than throwing when there is no session, because the
 * caller may still be presenting a shared key. A *failed* lookup (network,
 * database) also lands here as null; that is deliberate — the key path is
 * checked next and, if that fails too, the request is refused. No path
 * silently succeeds.
 */
async function sessionCaller(req: Request): Promise<ExpedionCaller | null> {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) return null;

    let isAdmin = false;
    try {
      isAdmin = await usersDAL.userHasRole(session.user.id, "admin");
    } catch (error) {
      // Fail closed on the *privilege*, not on the identity: an unreadable
      // role table must not promote anyone, but it also should not stop a
      // buyer from reading their own quotes.
      console.error("[expedion-auth] role lookup failed", error);
    }

    return { userId: session.user.id, isAdmin, via: "session" };
  } catch (error) {
    console.error("[expedion-auth] session lookup failed", error);
    return null;
  }
}

/**
 * Authenticates a call from the Expedion client.
 *
 * @throws {ExpedionAuthError} 401 when neither a session nor a valid key is
 * presented, 400 when a key-authenticated caller did not say which user it is
 * acting for.
 */
export async function requireExpedionCaller(
  req: Request
): Promise<ExpedionCaller> {
  // 1. A real user session wins, and needs no shared secret.
  const fromSession = await sessionCaller(req);
  if (fromSession) return fromSession;

  // 2. Otherwise fall back to the app-level keys.
  const clientKey = process.env.EXPEDION_API_KEY;
  const adminKey = process.env.EXPEDION_ADMIN_API_KEY;

  const presented = bearer(req);
  if (!presented) throw new ExpedionAuthError("UNAUTHORIZED", 401);

  if (!clientKey && !adminKey) {
    // Fail closed. Missing configuration must never mean "let everyone in" —
    // and by this point we know there is no session either.
    throw new ExpedionAuthError(
      "EXPEDION_API_KEY_UNSET",
      503,
      "Expedion bridge is not configured"
    );
  }

  const isAdmin = !!adminKey && safeEqual(presented, adminKey);
  if (!isAdmin && !(clientKey && safeEqual(presented, clientKey))) {
    throw new ExpedionAuthError("UNAUTHORIZED", 401);
  }

  const userId = req.headers.get("x-expedion-uid")?.trim();
  if (!userId) {
    throw new ExpedionAuthError(
      "MISSING_UID",
      400,
      "x-expedion-uid header is required"
    );
  }

  return { userId, isAdmin, via: isAdmin ? "admin-key" : "client-key" };
}

/**
 * Admin-only variant, for repricing, driver assignment and forced escalation.
 */
export async function requireExpedionAdmin(
  req: Request
): Promise<ExpedionCaller> {
  const caller = await requireExpedionCaller(req);
  if (!caller.isAdmin) throw new ExpedionAuthError("FORBIDDEN", 403);
  return caller;
}
