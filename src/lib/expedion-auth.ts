/**
 * Authenticating the Expedion Flutter client.
 *
 * Expedion keeps Firebase Auth for this phase (expedion_encheres ROADMAP.md §5)
 * while Expeditoo runs Better Auth, so a Firebase session means nothing to
 * `auth.api.getSession`. Until the two converge, the Flutter app authenticates
 * to these routes with a shared bearer key and states which Firebase UID it is
 * acting for — the same shape as the existing `CRON_SECRET` routes.
 *
 * The trust model this buys is worth being explicit about: the bearer key
 * authenticates *the Expedion app*, not the end user. Any holder of the key can
 * claim any UID. That is acceptable only because the key lives in a server-side
 * build and never ships to a browser. Two consequences follow:
 *
 *   1. `EXPEDION_API_KEY` must never be compiled into the Flutter web bundle.
 *      Route Expedion's calls through its own server, or finish the Firebase →
 *      Better Auth migration, before exposing any of this to a web client.
 *   2. Admin-only operations take a *separate* key, so leaking the client key
 *      cannot reprice or reassign a job.
 */

export interface ExpedionCaller {
  firebaseUid: string;
  isAdmin: boolean;
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
 * Authenticates a call from the Expedion client.
 *
 * @throws {ExpedionAuthError} 401 when the key is absent or wrong, 400 when the
 * caller did not say which user it is acting for.
 */
export function requireExpedionCaller(req: Request): ExpedionCaller {
  const clientKey = process.env.EXPEDION_API_KEY;
  const adminKey = process.env.EXPEDION_ADMIN_API_KEY;

  if (!clientKey) {
    // Fail closed. A missing key must never mean "let everyone in".
    throw new ExpedionAuthError(
      "EXPEDION_API_KEY_UNSET",
      503,
      "Expedion bridge is not configured"
    );
  }

  const presented = bearer(req);
  if (!presented) throw new ExpedionAuthError("UNAUTHORIZED", 401);

  const isAdmin = !!adminKey && safeEqual(presented, adminKey);
  if (!isAdmin && !safeEqual(presented, clientKey)) {
    throw new ExpedionAuthError("UNAUTHORIZED", 401);
  }

  const firebaseUid = req.headers.get("x-expedion-uid")?.trim();
  if (!firebaseUid) {
    throw new ExpedionAuthError(
      "MISSING_UID",
      400,
      "x-expedion-uid header is required"
    );
  }

  return { firebaseUid, isAdmin };
}

/**
 * Admin-only variant, for repricing, driver assignment and forced escalation.
 */
export function requireExpedionAdmin(req: Request): ExpedionCaller {
  const caller = requireExpedionCaller(req);
  if (!caller.isAdmin) throw new ExpedionAuthError("FORBIDDEN", 403);
  return caller;
}
