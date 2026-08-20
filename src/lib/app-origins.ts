/**
 * Which of the two products a request came from.
 *
 * EXPEDITOO (this app) and Expedion (the sibling quote product, a Flutter app
 * on its own origin) share one Better Auth instance and one `user` table, so
 * the only thing that distinguishes a signup is where it was made from.
 * `EXPEDION_APP_ORIGINS` is the same variable proxy.ts uses for CORS and
 * auth.ts for trusted origins.
 */

export type AppOrigin = "expeditoo" | "expedion";

export function expedionOrigins(): string[] {
  return (process.env.EXPEDION_APP_ORIGINS?.split(",") ?? [])
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/**
 * EXPEDITOO unless the request came from one of Expedion's origins.
 *
 * A request with no Origin header is EXPEDITOO: native Expedion builds send
 * none, but so does every server-side and same-origin call, and defaulting the
 * unknown case to "expedion" would mislabel far more rows than it caught.
 */
export function originOfRequest(requestOrigin: string | null): AppOrigin {
  if (!requestOrigin) return "expeditoo";

  return expedionOrigins().includes(requestOrigin.trim())
    ? "expedion"
    : "expeditoo";
}
