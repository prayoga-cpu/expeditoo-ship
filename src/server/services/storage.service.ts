import { StorageProvider } from "@/server/interfaces/storage.interface";
import { R2StorageProvider } from "./storage/r2.provider";

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
