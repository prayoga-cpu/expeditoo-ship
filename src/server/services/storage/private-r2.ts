import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * A private R2 store: objects written under a prefix that has no public URL,
 * read only through a short-lived presigned link minted after the caller has
 * already been authorised.
 *
 * This exists because `kyc-storage.service.ts` and
 * `expedion-storage.service.ts` are the same forty lines twice over, and
 * shipment photos would have made it three times. Those two are deliberately
 * left alone — they work, and rewriting storage that already holds identity
 * documents to save a copy is a bad trade — but nothing new should be a fourth.
 *
 * It is emphatically NOT `storage.service.ts` / `r2.provider.ts`. That is the
 * public listing-photo path: it returns `${R2_PUBLIC_URL}/<key>`, which anyone
 * holding the string can read forever.
 *
 * `bucketEnvVars` is an ordered fallback list and every entry must name a
 * *private* bucket. `R2_BUCKET_NAME` must never appear in one:
 * `imageCleanupService.performCleanup` lists every object in that bucket and
 * deletes anything it cannot match to a known column, so a private object
 * parked there is deleted on the first non-dry run.
 */
export interface PrivateR2Store {
  /** Returns the object key. There is no URL form of this. */
  upload(key: string, body: Buffer, mimeType: string): Promise<string>;
  /** Caller must have authorised already; this function assumes it. */
  presignRead(objectKey: string): Promise<string>;
}

/** Long enough to load a photo, short enough that a leaked link is worthless. */
const PRESIGN_TTL_SECONDS = 300;

export function createPrivateR2Store(options: {
  /** For the error message when configuration is missing. */
  label: string;
  bucketEnvVars: readonly string[];
}): PrivateR2Store {
  let client: S3Client | null = null;
  let bucket: string | null = null;

  function ensureClient() {
    if (client && bucket) return { client, bucket };

    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = options.bucketEnvVars
      .map((name) => process.env[name])
      .find((value) => !!value);

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      throw new Error(
        `Missing R2 configuration for ${options.label} (set one of ` +
          `${options.bucketEnvVars.join(", ")} — R2_BUCKET_NAME is the public ` +
          `bucket and is swept by the image-cleanup cron)`
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

  return {
    async upload(key, body, mimeType) {
      const { client, bucket } = ensureClient();

      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: mimeType,
        })
      );

      return key;
    },

    async presignRead(objectKey) {
      const { client, bucket } = ensureClient();

      return await getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: bucket, Key: objectKey }),
        { expiresIn: PRESIGN_TTL_SECONDS }
      );
    },
  };
}
