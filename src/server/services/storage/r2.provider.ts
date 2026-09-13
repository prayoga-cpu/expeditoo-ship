import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import type {
  StorageProvider,
  StoredObject,
} from "@/server/interfaces/storage.interface";

/** R2 answers a missing key the way S3 does, under either of two names. */
function isMissingObject(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { name, $metadata } = error as {
    name?: unknown;
    $metadata?: { httpStatusCode?: number };
  };
  return name === "NoSuchKey" || name === "NotFound" || $metadata?.httpStatusCode === 404;
}

export class R2StorageProvider implements StorageProvider {
  private client: S3Client | null = null;
  private bucket: string | null = null;
  private publicUrl: string | null = null;

  private ensureInitialized() {
    if (this.client && this.bucket && this.publicUrl) return;

    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_BUCKET_NAME;
    const publicUrl = process.env.R2_PUBLIC_URL;

    if (
      !accountId ||
      !accessKeyId ||
      !secretAccessKey ||
      !bucket ||
      !publicUrl
    ) {
      throw new Error("Missing R2 configuration environment variables");
    }

    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    this.bucket = bucket;
    this.publicUrl = publicUrl;
  }

  async upload(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<string> {
    this.ensureInitialized();

    const command = new PutObjectCommand({
      Bucket: this.bucket!,
      Key: fileName,
      Body: fileBuffer,
      ContentType: mimeType,
    });

    await this.client!.send(command);

    return `${this.publicUrl}/${fileName}`;
  }

  /**
   * Streams the object instead of buffering it, so a large photo costs the
   * function its bytes in transit rather than its size in memory.
   */
  async read(key: string): Promise<StoredObject | null> {
    this.ensureInitialized();

    try {
      const response = await this.client!.send(
        new GetObjectCommand({ Bucket: this.bucket!, Key: key })
      );
      if (!response.Body) return null;

      return {
        body: response.Body.transformToWebStream() as ReadableStream<Uint8Array>,
        contentType: response.ContentType ?? null,
        contentLength: response.ContentLength ?? null,
      };
    } catch (error) {
      if (isMissingObject(error)) return null;
      throw error;
    }
  }

  async delete(fileUrl: string): Promise<void> {
    this.ensureInitialized();

    const fileName = fileUrl.replace(`${this.publicUrl}/`, "");

    const command = new DeleteObjectCommand({
      Bucket: this.bucket!,
      Key: fileName,
    });

    await this.client!.send(command);
  }

  async list(
    cursor?: string,
    limit: number = 1000
  ): Promise<{ keys: string[]; nextCursor?: string }> {
    this.ensureInitialized();

    const command = new ListObjectsV2Command({
      Bucket: this.bucket!,
      ContinuationToken: cursor,
      MaxKeys: limit,
    });

    const response = await this.client!.send(command);

    return {
      keys: response.Contents?.map((item) => item.Key!).filter(Boolean) || [],
      nextCursor: response.NextContinuationToken,
    };
  }
}
