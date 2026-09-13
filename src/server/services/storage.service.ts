import type {
  StorageProvider,
  StoredObject,
} from "@/server/interfaces/storage.interface";
import { R2StorageProvider } from "./storage/r2.provider";
import { StorageError } from "./storage/storage-error";

/**
 * The upload route writes `<userId>/<nanoid>.<ext>`. A key hundreds of
 * characters long is not one of ours, and there is no reason to ask R2 for it.
 */
const MAX_KEY_LENGTH = 512;

/**
 * Refuses anything that is not a plain relative key before storage sees it.
 *
 * R2 has no directories, so `..` would not escape anything there — but the key
 * arrives from a URL, and a store that answers traversal-shaped input is one
 * migration to a filesystem-backed provider away from being a real hole.
 */
/** Code points below 0x20 — a key carrying one is never an upload of ours. */
const hasControlCharacter = (key: string) =>
  Array.from(key).some((char) => char.charCodeAt(0) < 0x20);

function assertPublicKey(key: string): void {
  const invalid =
    !key ||
    key.length > MAX_KEY_LENGTH ||
    key.startsWith("/") ||
    key.includes("\\") ||
    hasControlCharacter(key) ||
    key.split("/").some((part) => part === "" || part === "." || part === "..");

  if (invalid) {
    throw new StorageError("INVALID_IMAGE_KEY", 400, "That is not an image address");
  }
}

class StorageService {
  private provider: StorageProvider;

  constructor() {
    // We can switch providers here based on env or config
    // For now, we default to R2
    this.provider = new R2StorageProvider();
  }

  async uploadImage(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<string> {
    return this.provider.upload(fileBuffer, fileName, mimeType);
  }

  /**
   * One public image, for `GET /api/images/[...key]`.
   *
   * Only `image/*` is served. Everything the upload route writes has been
   * re-encoded to WebP by sharp, so this refuses nothing legitimate — and it
   * means the one route in the app that serves stored bytes from its own origin
   * cannot be made to serve anything else.
   */
  async readImage(key: string): Promise<StoredObject> {
    assertPublicKey(key);

    const object = await this.provider.read(key);
    if (!object || !object.contentType?.startsWith("image/")) {
      await object?.body.cancel().catch(() => undefined);
      throw new StorageError("IMAGE_NOT_FOUND", 404, "Image not found");
    }

    return object;
  }

  async deleteImage(fileUrl: string): Promise<void> {
    return this.provider.delete(fileUrl);
  }

  async listObjects(
    cursor?: string,
    limit?: number
  ): Promise<{ keys: string[]; nextCursor?: string }> {
    return this.provider.list(cursor, limit);
  }
}

export const storageService = new StorageService();
