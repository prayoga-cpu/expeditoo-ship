/** One stored object, streamed rather than buffered. */
export interface StoredObject {
  body: ReadableStream<Uint8Array>;
  contentType: string | null;
  contentLength: number | null;
}

export interface StorageProvider {
  /**
   * Read one object by key, or null when there is no such object.
   * @param key The object key — the part of a public URL after the base
   */
  read(key: string): Promise<StoredObject | null>;

  /**
   * Upload a file to the storage provider
   * @param fileBuffer The file content as a buffer
   * @param fileName The name of the file
   * @param mimeType The MIME type of the file
   * @returns The public URL of the uploaded file
   */
  upload(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<string>;

  /**
   * Delete a file from the storage provider
   * @param fileUrl The URL of the file to delete
   */
  delete(fileUrl: string): Promise<void>;

  /**
   * List files in the storage provider
   * @param cursor The pagination cursor
   * @param limit The number of items to return
   */
  list(
    cursor?: string,
    limit?: number
  ): Promise<{ keys: string[]; nextCursor?: string }>;
}
