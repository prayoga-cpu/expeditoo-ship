import type { NextRequest } from "next/server";

/**
 * Shared secret check for scheduled jobs.
 *
 * Accepts either an Authorization bearer (how Vercel Cron calls it) or a
 * `secret` query parameter (how it is triggered manually). Returns false when
 * CRON_SECRET is unset, so a misconfigured deployment fails closed rather than
 * exposing the endpoint to anyone.
 */
export function isAuthorisedCron(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const authHeader = req.headers.get("authorization");
  const querySecret = new URL(req.url).searchParams.get("secret");

  return authHeader === `Bearer ${expected}` || querySecret === expected;
}
