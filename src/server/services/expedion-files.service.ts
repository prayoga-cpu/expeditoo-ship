import { expedionFilesDal } from "@/server/dal/expedion-files.dal";
import { expedionStorageService } from "@/server/services/expedion-storage.service";
import { imageUrlToBase64DataUrl } from "@/lib/ai/openai";
import { expedionFileIdFromUrl } from "@/lib/expedion-files";

/**
 * Reading a stored Expedion document server-side.
 *
 * The AI readers — `reextractDocument` and the price suggestion's document
 * parts — used to call `imageUrlToBase64DataUrl`, which is a bare `fetch()`
 * with no credentials. That worked while every stored URL was a Firebase
 * download link carrying its own `?token=…`, and it keeps working for those:
 * they still resolve, because the token is checked by the Storage service
 * rather than by the Security Rules that changed.
 *
 * It does not work for the URLs the new upload route writes.
 * `/api/expedion/files/<id>` is owner-or-admin gated, and an internal fetch
 * carries no cookie and no bearer token, so the deployment would 401 its own
 * request — a failure mode that looks exactly like "the document is
 * unreadable" and would silently turn every new quote's auto-extraction into a
 * 422. So a ship URL is resolved through the database and read straight out of
 * R2 instead, which also removes the presign-TTL race: a 300-second URL handed
 * to a 120-second vision call is a bet, not a design.
 *
 * ## Why [ownerUserId] is required and not optional
 *
 * `bordereau_doc_url` and `photo_urls` are *client-supplied* strings —
 * `createQuote` and `updateQuote` both write whatever the body says. Resolving
 * a `/api/expedion/files/<id>` URL through the table with no further question
 * would therefore make the file id a bearer token on this path, and a stronger
 * one than it is on the route: `GET /api/expedion/files/<id>` refuses a caller
 * who is neither the owner nor an admin, while this function would have read
 * the object for anyone who could get the string into a column. The way in is
 * short — file a quote naming somebody else's file, and `createQuote`'s
 * automatic re-extraction reads that document and writes what the model found
 * (buyer, address, phone, lot, declared value) onto the quote you own and can
 * fetch back.
 *
 * The id is a `nanoid()` and is not guessable, so this is a lock on a door
 * nobody currently has the key to. It is still a lock worth fitting: ids leak
 * in ways objects do not — a support-chat paste, a screenshot, an Airtable
 * record written by the two legacy forms — and the whole design rests on "the
 * only thing that authorises a read is a comparison against `owner_user_id`".
 * Doing that comparison in one place and doing it everywhere is cheaper than
 * arguing about which callers are safe.
 *
 * [ownerUserId] is the owner of the *quote the URL is stored on*, not the
 * caller: an admin re-running the extraction from supervision is reading a
 * client's document on that client's behalf, which is exactly what the file
 * route's admin branch already allows. It matches `expedion_quotes.firebase_uid`
 * against `expedion_files.owner_user_id`, which the upload route fills from the
 * same authenticated identity.
 */
export async function bordereauDataUrl(
  storedUrl: string | null | undefined,
  ownerUserId: string
): Promise<string | null> {
  if (!storedUrl) return null;

  const fileId = expedionFileIdFromUrl(storedUrl);
  if (!fileId) {
    // Not ours: a Firebase download URL, or anything an Airtable import left
    // behind. Unchanged behaviour, deliberately.
    return await imageUrlToBase64DataUrl(storedUrl);
  }

  const file = await expedionFilesDal.getById(fileId);
  if (!file) {
    console.error("[expedion-files] no row for file id", fileId);
    return null;
  }

  if (file.ownerUserId !== ownerUserId) {
    /*
     * Null rather than a throw, for the same reason every other failure here
     * is null: the callers treat "unreadable" as a skip or a 422, and a quote
     * whose bordereau column names a stranger's file is a quote that simply
     * does not get auto-extracted. Neither id is logged — the mismatch is the
     * fact worth recording, and the log drain is not the place for either
     * identity (see `recordVia` in `expedion-auth.ts`).
     */
    console.error(
      "[expedion-files] refused: stored file is not owned by the quote's owner"
    );
    return null;
  }

  return await expedionStorageService.readToDataUrl(file.objectKey);
}

/**
 * Links the files a quote was filed with to that quote.
 *
 * The upload happens before the quote exists — the client picks a bordereau on
 * a form it may still abandon — so `quote_id` can only be filled afterwards,
 * from the URLs the client actually submitted. Best-effort on purpose: the
 * column is provenance, not authorisation (a read is authorised against
 * `owner_user_id`), so failing to write it must never fail a quote.
 *
 * Scoped to [ownerUserId] because the URLs come off the request body. Without
 * it, filing a quote that names somebody else's file id would repoint that
 * row's `quote_id` at your quote — a cross-tenant write, and one that also
 * detaches the file from the quote it actually belongs to. The rows that do
 * not match are silently left alone rather than reported: there is nothing the
 * client could do about it and nothing here depends on the count.
 */
export async function attachUploadedFilesToQuote(
  quoteId: string,
  ownerUserId: string,
  urls: (string | null | undefined)[]
): Promise<void> {
  const ids = urls
    .map((u) => expedionFileIdFromUrl(u))
    .filter((id): id is string => id !== null);

  if (ids.length === 0) return;

  try {
    await expedionFilesDal.attachToQuote(ids, quoteId, ownerUserId);
  } catch (error) {
    console.error("[expedion-files] attach to quote failed", quoteId, error);
  }
}
