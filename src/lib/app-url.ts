/**
 * Where this app lives, in one place.
 *
 * `NEXT_PUBLIC_APP_URL` is the answer on every deployment that sets it. The
 * constant below is only what a link falls back to when it is unset — it used
 * to be `https://expeditoo.com`, a domain nobody here owns, pasted into fifteen
 * files, so a missing variable put a stranger's site in an email
 * (`docs/specs/domain_expeditop_fr_spec.md`).
 *
 * Server code only reads the variable at call time; the client bundle gets it
 * inlined at build time, which is why changing it in Vercel needs a redeploy.
 */

/** The canonical production origin — the www host; the apex redirects to it. */
export const PRODUCTION_ORIGIN = "https://www.expeditop.fr";

/** The bare host, for copy that names the site rather than linking to it. */
export const PRODUCTION_HOST = "www.expeditop.fr";

/** The domain mail addresses are written on (`support@expeditop.fr`). */
export const MAIL_DOMAIN = "expeditop.fr";

/** `local@expeditop.fr` — the one place an address is composed. */
export function mailbox(local: string): string {
  return `${local}@${MAIL_DOMAIN}`;
}

/** The app's origin, without a trailing slash. */
export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || PRODUCTION_ORIGIN).replace(
    /\/+$/,
    "",
  );
}
