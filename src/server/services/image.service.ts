import sharp from "sharp";

export class ImageService {
  /**
   * Compress and resize image
   * @param buffer Input image buffer
   * @returns Compressed image buffer
   */
  async compress(
    buffer: Buffer
  ): Promise<{ buffer: Buffer; mimeType: string; ext: string }> {
    const processed = await sharp(buffer)
      .resize(1920, 1920, {
        // Limit max dimensions
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 80 }) // Convert to WebP with 80% quality
      .toBuffer();

    return {
      buffer: processed,
      mimeType: "image/webp",
      ext: "webp",
    };
  }
}

export const imageService = new ImageService();
