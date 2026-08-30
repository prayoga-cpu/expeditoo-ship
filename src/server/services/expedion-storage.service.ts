import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { nanoid } from "nanoid";

/**
 * Storage for Expedion's uploaded documents — bordereaux and lot photos.
 *
 * Modelled on `kyc-storage.service.ts`, and for the same reason: a bordereau
 * carries the buyer's name, address, phone, the lot description and its
 * declared value, and some of what gets attached is an identity document.
 * These are private documents, so they are written under a private prefix and
 * never given a public URL. `upload()` returns an object key; reads go through
 * a short-lived presigned URL issued only after the caller has been
 * authorised, or — for server-side readers that already hold the key — through
 * [readToDataUrl], which never mints a URL at all.
 *
 * This deliberately does NOT use `storage.service.ts` / `r2.provider.ts`. That
 * is the public listing-photo path: it returns `${R2_PUBLIC_URL}/<key>`, which
 * anyone holding the string can read. Handing a bordereau a permanent public
 * URL would recreate the exact exposure the Firebase migration just closed.
 */

const PRIVATE_PREFIX = "expedion";
/** Long enough to open a PDF, short enough that a leaked link is worthless. */
const PRESIGN_TTL_SECONDS = 300;

let client: S3Client | null = null;
let bucket: string | null = null;

function ensureClient() {
  if (client && bucket) return { client, bucket };

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  /*
   * A dedicated private bucket, falling back only to the *other* private
   * bucket (KYC's). There is no fall back to `R2_BUCKET_NAME`, and that
   * omission is load-bearing rather than an oversight:
   * `imageCleanupService.performCleanup` lists every object in that bucket and
   * deletes anything not referenced by `user.image`, `categories.image`,
   * `photos.url` or `messages.attachmentUrl`.
   * Bordereaux are referenced by none of those, so the nightly cron would
   * delete every one of them on its first non-dry run. Failing to start is a
   * far better outcome than starting and being quietly emptied.
   */
  const bucketName =
    process.env.R2_EXPEDION_BUCKET_NAME ?? process.env.R2_KYC_BUCKET_NAME;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error(
      "Missing R2 configuration for Expedion storage (set R2_EXPEDION_BUCKET_NAME or R2_KYC_BUCKET_NAME — R2_BUCKET_NAME is the public bucket and is swept by the image-cleanup cron)"
    );
  }

  client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  bucket = bucketName;

  return { client, bucket };
}

export const expedionStorageService = {
  /** Returns the object key, never a URL - there is no public URL for these. */
  async upload(
    ownerUserId: string,
    kind: string,
    fileBuffer: Buffer,
    mimeType: string
  ): Promise<string> {
    const { client, bucket } = ensureClient();
    /*
     * The owner segment namespaces one user's uploads away from another's, and
     * the `nanoid()` means two uploads of the same file by the same person do
     * not overwrite each other. The original filename is not used: it is
     * attacker-controlled, and a bordereau's is routinely the buyer's own name.
     */
    const key = `${PRIVATE_PREFIX}/${ownerUserId}/${kind}-${nanoid()}`;

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType,
      })
    );

    return key;
  },

  /**
   * Issues a time-limited read URL. Callers must authorise first - this
   * function assumes that has already happened.
   */
  async presignRead(objectKey: string): Promise<string> {
    const { client, bucket } = ensureClient();

    return await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: objectKey }),
      { expiresIn: PRESIGN_TTL_SECONDS }
    );
  },

  /**
   * Reads an object straight into memory, for server-side consumers that
   * already hold the key.
   *
   * The AI readers (`reextractDocument`, the price suggestion's document
   * parts) used to `fetch()` the stored URL.
   * They cannot do that against `/api/expedion/files/<id>`: an internal fetch
   * carries no session, so the deployment would 401 its own request. Nor
   * should they presign and fetch — a 120-second vision call against a
   * 300-second URL is a race waiting to be lost, and it puts an
   * unauthenticated link on the wire for no gain. Reading the bytes here skips
   * both problems.
   */
  async readToDataUrl(objectKey: string): Promise<string | null> {
    try {
      const { client, bucket } = ensureClient();

      const result = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: objectKey })
      );
      if (!result.Body) return null;

      const bytes = await result.Body.transformToByteArray();
      const base64 = Buffer.from(bytes).toString("base64");
      const contentType = result.ContentType || "application/octet-stream";

      return `data:${contentType};base64,${base64}`;
    } catch (error) {
      // Same contract as `imageUrlToBase64DataUrl`: null, not a throw. Every
      // caller already treats "the document could not be read" as a skip or a
      // 422, and none of them wants a storage outage surfacing as a 500.
      //
      // The key is deliberately absent from the line. It is
      // `expedion/<userId>/…`, so printing it puts a user id in Vercel's log
      // drain — which `recordVia` in `expedion-auth.ts` goes out of its way
      // not to do, on the grounds that the drain is not access-controlled the
      // way the database is. The error itself carries the bucket, the status
      // and the S3 request id, which is what a storage failure is actually
      // diagnosed from.
      console.error("[expedion-storage] read failed", error);
      return null;
    }
  },
};
