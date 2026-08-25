/**
 * POST /api/expedion/upload
 *
 * Stores a bordereau or a lot photo and returns the URL the quote will hold.
 *
 * This replaces Firebase Storage, which the Flutter client wrote to directly
 * at `users/<uid>/uploads/…`. The rule guarding that path matched
 * `request.auth.uid` against the `<uid>` segment; once Expedion moved onto
 * Better Auth there was no `request.auth` at all, so every upload by an
 * account created since the migration was denied — and the bordereau form,
 * which will not enable its submit button without a document URL, stopped
 * working outright for those users.
 *
 * The body is the same base64 shape `/api/expedion/extract` already takes,
 * rather than multipart: the client has one serialization to build, one set of
 * headers, and — in the bordereau flow — the very same base64 string it
 * already produces to have the document checked at pick time.
 *
 * What comes back is a stable app URL, not the object key and not a presigned
 * one. Not the key, because `photoUrls` is validated as `z.string().url()`,
 * the admin dialog only previews `https?:` and the AI readers are handed the
 * column's value directly. Not a presigned URL, because this string is
 * persisted — into `bordereau_doc_url`, and into a SharedPreferences draft the
 * client keeps for thirty days — so it would be dead within five minutes, and
 * until it died it would be an unauthenticated link to a document carrying the
 * buyer's name, address and declared value sitting in Postgres. Which is the
 * leak the Firebase move just closed.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { requireExpedionCaller } from "@/lib/expedion-auth";
import { expedionErrorResponse } from "@/lib/expedion-response";
import { ExpedionError } from "@/server/services/expedion.service";
import { expedionStorageService } from "@/server/services/expedion-storage.service";
import { expedionFilesDal } from "@/server/dal/expedion-files.dal";
import { expedionFileUrl } from "@/lib/expedion-files";

export const dynamic = "force-dynamic";
/*
 * A 3 MB PDF arrives base64-encoded (so ~4 MB on the wire), is decoded, and is
 * then a single PUT to R2 from a function that may be a continent away from
 * the bucket. Well under `extract`'s 120 s vision budget, comfortably over the
 * 10 s default that would time out a slow mobile upload.
 */
export const maxDuration = 60;

/**
 * The client's own cap, enforced again here.
 *
 * `kBordereauMaxBytes` in the Flutter app is 3 MB and rejects before upload,
 * but a client-side limit is a courtesy to the user, not a control: this is
 * the number that actually bounds what a caller can put in the bucket.
 * Measured on the decoded bytes, since that is what gets stored.
 */
const MAX_BYTES = 3 * 1024 * 1024;

/**
 * What a bordereau or a lot photo can be. The four the client's own picker
 * offers (`kBordereauExtensions`: pdf, jpg/jpeg, png, webp) and nothing else —
 * an allow-list, so a format neither the extraction model nor the admin
 * preview can open is refused at the door rather than stored and discovered
 * later. HEIC is absent deliberately: the client re-encodes camera captures,
 * and the vision model cannot read it.
 */
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const uploadSchema = z.object({
  /** Base64 payload, with or without the `data:` prefix. */
  data: z.string().min(1),
  mimeType: z.string().min(1),
  /**
   * Accepted and then dropped. The client sends it because `extract` takes it
   * and the two calls carry the same body, but nothing here reads it and
   * nothing stores it: it is attacker-controlled, a bordereau's filename is
   * routinely the buyer's own name, and the object key is built from the
   * authenticated caller instead. Refusing the field would only make the
   * client maintain two body shapes for the same file.
   */
  filename: z.string().optional(),
  kind: z.enum(["bordereau", "photo"]).default("bordereau"),
});

/** Strips a `data:<mime>;base64,` prefix if the client sent the whole URL. */
function decodeBase64(data: string): Buffer {
  const payload = data.replace(/^data:[^;]+;base64,/, "");
  const buffer = Buffer.from(payload, "base64");

  if (buffer.length === 0) {
    throw new ExpedionError(
      "INVALID_FILE",
      400,
      "Le fichier est vide ou mal encodé"
    );
  }

  return buffer;
}

export async function POST(req: NextRequest) {
  try {
    const caller = await requireExpedionCaller(req);
    const input = uploadSchema.parse(await req.json());

    // Normalised before the check so `image/JPEG` and a stray `; charset=…`
    // from a mobile picker are not read as unknown formats.
    const mimeType = input.mimeType.split(";")[0].trim().toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new ExpedionError(
        "UNSUPPORTED_MEDIA_TYPE",
        415,
        "Format non pris en charge. Envoyez un PDF, un JPEG, un PNG ou un WEBP."
      );
    }

    const buffer = decodeBase64(input.data);
    if (buffer.length > MAX_BYTES) {
      throw new ExpedionError(
        "FILE_TOO_LARGE",
        413,
        "Le fichier dépasse la taille maximale de 3 Mo"
      );
    }

    const objectKey = await expedionStorageService.upload(
      caller.userId,
      input.kind,
      buffer,
      mimeType
    );

    const file = await expedionFilesDal.create({
      id: nanoid(),
      // The same identifier `expedion_quotes.firebase_uid` holds, so "owner of
      // the file" and "owner of the quote" are the same kind of thing.
      ownerUserId: caller.userId,
      // Filled in later, if the client goes on to file a quote with it.
      quoteId: null,
      kind: input.kind,
      objectKey,
      mimeType,
      sizeBytes: buffer.length,
    });

    return NextResponse.json({
      success: true,
      data: {
        fileId: file.id,
        url: expedionFileUrl(file.id),
        kind: input.kind,
      },
    });
  } catch (error) {
    return expedionErrorResponse(error);
  }
}
