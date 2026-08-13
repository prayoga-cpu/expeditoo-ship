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
  // Falls back to the main bucket; a dedicated private bucket is preferable in
  // production and is what R2_KYC_BUCKET_NAME selects.
  const bucketName = process.env.R2_KYC_BUCKET_NAME ?? process.env.R2_BUCKET_NAME;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error("Missing R2 configuration for KYC storage");
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
