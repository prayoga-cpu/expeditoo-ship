import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Verifying a Firebase ID token, without the Admin SDK.
 *
 * Expedion's older accounts live in Firebase Auth while new ones live in this
 * app's Better Auth (expedion_encheres INTEGRATION.md §8). Those clients have
 * no Better Auth session, so until now the only way they could reach
 * `/api/expedion/*` was the shared `EXPEDION_API_KEY` — which authenticates the
 * *app* and lets any holder claim any UID, and therefore must never ship in a
 * browser bundle. The practical effect was that a Firebase-signed-in web user
 * was told to "sign in" on a page they were already signed in to.
 *
 * A Firebase ID token fixes that properly: it is a plain RS256 JWT that Google
 * signs, so it can be verified from its public keys. That gives the server a
 * cryptographically established UID rather than a client-asserted one — the
 * same trust level as a Better Auth session, and strictly better than the key.
 *
 * No service account is involved. Verification needs only the project id, which
 * is public, plus Google's published keys. `firebase-admin` would pull in a
 * credential this server has no other reason to hold.
 */

/**
 * Google's JWKS for Firebase ID tokens.
 *
 * The x509 endpoint most Firebase docs cite serves PEM certificates; this is
 * the same keys in JWK form, which `jose` consumes directly. `createRemoteJWKSet`
 * caches and re-fetches on key rotation, so this is created once per process
 * rather than per request.
 */
const JWKS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
  )
);

/** Expedion's Firebase project. Public; it is the token's `aud` and `iss`. */
const PROJECT_ID =
  process.env.EXPEDION_FIREBASE_PROJECT_ID || "espaceperso-483p30";

export interface FirebaseIdentity {
  uid: string;
  email: string | null;
  emailVerified: boolean;
}

/**
 * Verifies a Firebase ID token and returns who it belongs to.
 *
 * Returns null for anything that does not verify — wrong signature, wrong
 * project, expired, or simply not a Firebase token (a Better Auth session token
 * reaches here too, and is expected to fail). Callers treat null as "this
 * credential is not a Firebase user" and move on to the next one.
 */
export async function verifyFirebaseIdToken(
  token: string
): Promise<FirebaseIdentity | null> {
  // Cheap structural reject before any network call: Better Auth session
  // tokens are opaque strings, not three dot-separated segments.
  if (token.split(".").length !== 3) return null;

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${PROJECT_ID}`,
      audience: PROJECT_ID,
      algorithms: ["RS256"],
    });

    // `sub` is the Firebase UID. Firebase also sets `user_id`; `sub` is the
    // registered claim and the one `jwtVerify` has already range-checked.
    const uid = typeof payload.sub === "string" ? payload.sub : null;
    if (!uid) return null;

    // `auth_time` in the future, or a token minted before the account existed,
    // would both be rejected by the signature check above; nothing further to
    // validate here beyond having a subject.
    return {
      uid,
      email: typeof payload.email === "string" ? payload.email : null,
      emailVerified: payload.email_verified === true,
    };
  } catch {
    // Deliberately quiet: this runs on every request that presents a bearer
    // token, and a Better Auth token failing here is the normal path, not an
    // error worth logging.
    return null;
  }
}
