/**
 * Where the sibling Expedion product lives on the web.
 *
 * It sat in `src/features/marketing/ui/styles.ts` while marketing was the only
 * surface that linked out. The job board links out too now — every job on it
 * started as a quote somebody paid for over there — and an app feature reaching
 * into the landing page's stylesheet for a URL is the wrong dependency, so the
 * constant moved here and `styles.ts` re-exports it.
 *
 * Hard-coded rather than read from the environment, on purpose: this is a
 * public destination in a link, not a secret, and `EXPEDION_APP_ORIGINS` — the
 * variable that does carry Expedion's origins — is server-only and would be
 * invisible to the client components that need this.
 *
 * Still a Vercel preview URL. When Expedion moves to its own domain, this is
 * the one line that changes.
 */
export const EXPEDION_URL = "https://expedion-encheres.vercel.app/";
