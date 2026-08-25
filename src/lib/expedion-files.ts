/**
 * Telling an Expedion file URL apart from every other stored URL.
 *
 * `expedion_quotes.bordereau_doc_url` and `photo_urls` now hold two kinds of
 * string at once, and will for as long as the pre-migration rows exist:
 *
 *   - Firebase download URLs written before the storage move. They still
 *     resolve — `?alt=media&token=…` is checked by the Storage service itself,
 *     not by Security Rules — so a plain `fetch()` remains the right way to
 *     read one.
 *   - `<APP_URL>/api/expedion/files/<id>`, written by the new upload route.
 *     Behind it is a private R2 object that only its owner or an admin may
 *     read, and that a server-side reader must fetch through the storage
 *     service rather than over HTTP.
 *
 * The test is positive — "is this one of ours" — rather than a
 * `firebasestorage.googleapis.com` sniff, so a URL from neither system (an
 * Airtable import, a hand-pasted link) is treated as foreign instead of being
 * mistaken for a ship file. And it compares the *pathname*, not a prefix of
 * the whole string, so a preview deployment does not misclassify the files it
 * wrote itself under a hostname that is not `NEXT_PUBLIC_APP_URL`.
 *
 * This module is imported by client components as well as by services, so it
 * must stay free of any database or storage import.
 */

/** The one path that identifies a file served by this app. */
export const EXPEDION_FILE_PATH_PREFIX = "/api/expedion/files/";

/** True when [url] is a `/api/expedion/files/<id>` URL on any host. */
export function isExpedionFileUrl(url: string | null | undefined): boolean {
  return expedionFileIdFromUrl(url) !== null;
}

/**
 * The file id inside an Expedion file URL, or null when [url] is not one.
 *
 * Anything after the id — a trailing segment, a query string — means the URL
 * is not one this app minted, so it is rejected rather than truncated to
 * something that happens to look like an id.
 */
export function expedionFileIdFromUrl(
  url: string | null | undefined
): string | null {
  if (!url) return null;

  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    // Not absolute. A relative path is still worth recognising: it is what a
    // hand-written test fixture or a column written by a future backfill may
    // hold, and it names the same route.
    if (!url.startsWith(EXPEDION_FILE_PATH_PREFIX)) return null;
    pathname = url.split("?")[0];
  }

  if (!pathname.startsWith(EXPEDION_FILE_PATH_PREFIX)) return null;

  const id = pathname.slice(EXPEDION_FILE_PATH_PREFIX.length);
  if (!id || id.includes("/")) return null;

  return decodeURIComponent(id);
}

/**
 * The stable URL for a stored file.
 *
 * Absolute, because it is persisted: into `bordereau_doc_url`, and into the
 * retrait form's SharedPreferences draft, which the Flutter client keeps for
 * thirty days. It also has to satisfy `z.array(z.string().url())` on
 * `photoUrls` and `/^https?:\/\//i` in the admin dialog's preview check.
 */
export function expedionFileUrl(fileId: string): string {
  const base = (
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  ).replace(/\/+$/, "");

  return `${base}${EXPEDION_FILE_PATH_PREFIX}${fileId}`;
}
