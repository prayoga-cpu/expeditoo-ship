/**
 * What an auth form says when the server refuses.
 *
 * Better Auth answers in English (« Invalid email or password », « User
 * already exists. Use another email. ») and the forms printed that sentence
 * as it came. Every refusal is now reduced to one of the keys below, and a
 * key is all a form ever holds: the sentence is `auth.errors.<key>` in the
 * person's language, and it names what to do next.
 *
 * The codes are Better Auth 1.4.6's (`BASE_ERROR_CODES`, @better-auth/core)
 * plus the one this app throws itself: `BANNED_USER`, from the session-create
 * hook in `src/lib/auth.ts`. An endpoint that throws a message with no code
 * gets its code derived from the message by better-call (upper-cased, spaces
 * to underscores, punctuation dropped), which is why « User already exists.
 * Use another email. » arrives as `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`.
 */

export const AUTH_ERROR_KEYS = [
  "invalidCredentials",
  "accountExists",
  "invalidEmail",
  "passwordTooShort",
  "passwordTooLong",
  "suspended",
  "rateLimited",
  "invalidToken",
  "network",
  "oauthFailed",
  "unknown",
] as const;

export type AuthErrorKey = (typeof AUTH_ERROR_KEYS)[number];

/**
 * Sign-in answers `INVALID_EMAIL_OR_PASSWORD` for a wrong password and for an
 * address it has never seen alike; nothing here tells the two apart either.
 */
export const AUTH_ERROR_CODES: Readonly<Record<string, AuthErrorKey>> = {
  INVALID_EMAIL_OR_PASSWORD: "invalidCredentials",
  USER_ALREADY_EXISTS: "accountExists",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "accountExists",
  INVALID_EMAIL: "invalidEmail",
  PASSWORD_TOO_SHORT: "passwordTooShort",
  PASSWORD_TOO_LONG: "passwordTooLong",
  BANNED_USER: "suspended",
  INVALID_TOKEN: "invalidToken",
};

/** Better Auth's rate limiter answers 429 with a message and no code. */
const TOO_MANY_REQUESTS = 429;

function field(error: unknown, name: "code" | "status"): unknown {
  if (typeof error !== "object" || error === null) return undefined;
  return (error as Record<string, unknown>)[name];
}

/** The key for an error the server answered with (`result.error`). */
export function authErrorKey(error: unknown): AuthErrorKey {
  const code = field(error, "code");
  if (typeof code === "string" && Object.hasOwn(AUTH_ERROR_CODES, code)) {
    return AUTH_ERROR_CODES[code];
  }
  if (field(error, "status") === TOO_MANY_REQUESTS) return "rateLimited";
  return "unknown";
}

/**
 * The key for a request that threw instead of answering. `fetch` rejects with
 * a `TypeError` when it never reached the server (offline, DNS, blocked);
 * anything else is not something the person's connection can fix.
 */
export function thrownAuthErrorKey(error: unknown): AuthErrorKey {
  return error instanceof TypeError ? "network" : "unknown";
}

/** Where the notice sends the person. The labels are `auth.errors.actions.*`. */
export type AuthErrorAction = {
  label: "forgotPassword" | "signIn" | "resetPassword" | "requestNewLink";
  href: "/signin" | "/forgot-password";
};

/**
 * The next step each refusal names. An empty list is a refusal whose way out
 * is in its own sentence: wait a minute, correct the field, write to support.
 */
export const AUTH_ERROR_ACTIONS: Readonly<
  Record<AuthErrorKey, readonly AuthErrorAction[]>
> = {
  invalidCredentials: [{ label: "forgotPassword", href: "/forgot-password" }],
  accountExists: [
    { label: "signIn", href: "/signin" },
    { label: "resetPassword", href: "/forgot-password" },
  ],
  invalidEmail: [],
  passwordTooShort: [],
  passwordTooLong: [],
  suspended: [],
  rateLimited: [],
  invalidToken: [{ label: "requestNewLink", href: "/forgot-password" }],
  network: [],
  // The sign-in form sits right under the notice: that is the way out.
  oauthFailed: [],
  unknown: [],
};

/**
 * What `?error=` on /signin means. Two things come back there: Better Auth's
 * verification link, when it verified nothing (`token_expired`,
 * `invalid_token` — the verify screen is where another code or link is
 * asked for), and a Google sign-in that did not finish (`onAPIError.errorURL`
 * and the OAuth callback both land on /signin). `access_denied` is the person
 * closing Google's window: nothing to say. A suspended account is sent here by
 * the session hook as `suspended`.
 */
export type SigninUrlError = { kind: "link" } | { kind: "notice"; key: AuthErrorKey } | { kind: "none" };

const LINK_ERRORS = new Set(["token_expired", "invalid_token"]);

export function signinUrlError(raw: string | null): SigninUrlError {
  if (!raw) return { kind: "none" };
  if (LINK_ERRORS.has(raw)) return { kind: "link" };
  if (raw === "access_denied") return { kind: "none" };
  if (raw === "suspended") return { kind: "notice", key: "suspended" };
  return { kind: "notice", key: "oauthFailed" };
}
