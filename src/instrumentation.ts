/**
 * Runs once when the Next.js server starts — `next dev`, `next start`, and
 * every Vercel deployment (production or preview) — before the first request
 * is served. This is the one place a misconfigured environment is caught at
 * boot instead of at the first payment or the first query.
 *
 * @see https://nextjs.org/docs/app/guides/instrumentation
 */
export async function register() {
  // The edge runtime (proxy.ts) also loads this file; the checks below need
  // Node's `process.env` semantics and only make sense to run once, so they
  // are scoped to the node runtime.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { assertEnvironmentIsSane } = await import("@/lib/env-assertions");
  assertEnvironmentIsSane();
}
