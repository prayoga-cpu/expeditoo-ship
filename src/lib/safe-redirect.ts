/**
 * A post-sign-in destination taken from `?callbackUrl=`, or `null`.
 *
 * Only a path inside this app is returned: it must start with a single `/`,
 * never `//` or `/\` (both read as another host), carry no control character,
 * and not point back at an auth screen, which would loop. Anything else is
 * ignored and the caller falls back to `/home` — an open redirect on a sign-in
 * page is a phishing gift.
 */
const AUTH_PATHS = ["/signin", "/signup", "/verify-email", "/forgot-password", "/reset-password"];

export function safeCallbackPath(raw: string | null | undefined): string | null {
  if (!raw || raw.length > 2000) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(raw)) return null;
  const path = raw.split(/[?#]/)[0].toLowerCase();
  if (AUTH_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) return null;
  return raw;
}
