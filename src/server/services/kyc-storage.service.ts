import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { nanoid } from "nanoid";

/**
 * Storage for carrier KYC documents.
 *
 * Deliberately separate from the listing-photo path: these are identity
 * documents, so they are written under a private prefix and never given a
 * public URL. Reads go through a short-lived presigned URL issued only after
 * the caller has been authorised (docs/specs/carrier_kyc_spec.md §4).
 */

const PRIVATE_PREFIX = "kyc";
/** Long enough to open a PDF, short enough that a leaked link is worthless. */
const PRESIGN_TTL_SECONDS = 300;

let client: S3Client | null = null;
let bucket: string | null = null;

function ensureClient() {
  if (client && bucket) return { client, bucket };

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  // Never R2_BUCKET_NAME. That is the public bucket, and the image-cleanup cron
  // lists every object in it and deletes anything it cannot match to a listing
  // photo - which is every KYC document on the platform. Falling back to it
  // used to be the behaviour here, and with R2_KYC_BUCKET_NAME unset in the
  // deployment it meant identity documents sat in a public bucket on a weekly
  // delete timer. `expedion-storage.service.ts` has refused the same fallback
  // for the same reason since it was written; this now matches it.
  const bucketName =
    process.env.R2_KYC_BUCKET_NAME ?? process.env.R2_EXPEDION_BUCKET_NAME;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error(
      "Missing R2 configuration for KYC storage (set R2_KYC_BUCKET_NAME - R2_BUCKET_NAME is the public bucket and is swept by the image-cleanup cron)"
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

export const kycStorageService = {
  /** Returns the object key, never a URL - there is no public URL for these. */
  async upload(
    carrierId: string,
    kind: string,
    fileBuffer: Buffer,
    mimeType: string
  ): Promise<string> {
    const { client, bucket } = ensureClient();
    const key = `${PRIVATE_PREFIX}/${carrierId}/${kind}-${nanoid()}`;

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
};
