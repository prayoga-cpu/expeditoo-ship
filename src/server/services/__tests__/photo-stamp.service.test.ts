import { describe, it, expect } from "vitest";
import sharp from "sharp";

import { photoStampService } from "../photo-stamp.service";

/**
 * Covers docs/specs/shipment_photos_spec.md §5, with real Sharp rather than a
 * mock: the questions here — is EXIF gone, does an ampersand in a street name
 * void the overlay — are exactly the ones a mock would answer wrongly.
 *
 * Nothing asserts on the *glyphs*. Text rendering depends on the host's fonts
 * (§5.4), so a pixel assertion here would fail on a machine that is fine and
 * pass on one that is not. What is asserted is the geometry and the encoding,
 * which are the same everywhere.
 */

const DETAILS = {
  stage: "pickup" as const,
  lat: 48.86919,
  lng: 2.33144,
  accuracyM: 8,
  address: "12 rue de la Paix, 75002 Paris",
  recordedAt: new Date("2026-08-29T12:32:00Z"),
  shipmentRef: "EXP-4F3A9C",
};

/** A JPEG carrying an EXIF block, as a phone would produce. */
async function photo(width = 4000, height = 3000) {
  return await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 120, g: 140, b: 160 },
    },
  })
    .withMetadata({ exif: { IFD0: { Copyright: "test-camera" } } })
    .jpeg()
    .toBuffer();
}

describe("the stamp", () => {
  it("re-encodes to WebP and bounds the long edge at 1920", async () => {
    const result = await photoStampService.stamp(await photo(), DETAILS);

    expect(result.mimeType).toBe("image/webp");
    const meta = await sharp(result.buffer).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(1920);
    expect(meta.height).toBeLessThanOrEqual(1920);
    expect(result.sizeBytes).toBe(result.buffer.byteLength);
  }, 30_000);

  it("does not enlarge a small photo", async () => {
    const result = await photoStampService.stamp(await photo(640, 480), DETAILS);

    const meta = await sharp(result.buffer).metadata();
    expect(meta.width).toBe(640);
  }, 30_000);

  // EXIF GPS is editable with a text editor, so it is dropped rather than read.
  it("drops the metadata block the camera wrote", async () => {
    const result = await photoStampService.stamp(await photo(800, 600), DETAILS);

    const meta = await sharp(result.buffer).metadata();
    expect(meta.exif).toBeUndefined();
  }, 30_000);

  it("survives an address carrying XML metacharacters", async () => {
    const result = await photoStampService.stamp(await photo(800, 600), {
      ...DETAILS,
      address: 'Rue A & B <"C"> \'D\'',
    });

    // A raw `&` in the SVG would have thrown rather than produced an image.
    const meta = await sharp(result.buffer).metadata();
    expect(meta.format).toBe("webp");
  }, 30_000);

  it("produces a shorter band when there is no address to name", async () => {
    const source = await photo(800, 600);
    const withAddress = await photoStampService.stamp(source, DETAILS);
    const without = await photoStampService.stamp(source, {
      ...DETAILS,
      address: null,
    });

    /*
     * Measured rather than inferred from the byte count, which is a
     * compression artefact and not a fact about the band. At 800px wide the
     * three-line panel is 105px tall and the two-line one is 80px, so a strip
     * 95px from the bottom is inside one and above the other — dark in the
     * first case, the plain background in the second.
     */
    const strip = (buffer: Buffer) =>
      sharp(buffer)
        .extract({ left: 0, top: 600 - 95, width: 800, height: 2 })
        .stats();

    const dimmed = await strip(withAddress.buffer);
    const plain = await strip(without.buffer);

    expect(dimmed.channels[0].mean).toBeLessThan(plain.channels[0].mean);
  }, 30_000);

  it("applies EXIF orientation before dropping it", async () => {
    // Orientation 6 = rotate 90°: a 800x600 frame must come out 600x800.
    const rotated = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 10, g: 20, b: 30 },
      },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();

    const result = await photoStampService.stamp(rotated, DETAILS);
    const meta = await sharp(result.buffer).metadata();

    expect(meta.width).toBe(600);
    expect(meta.height).toBe(800);
  }, 30_000);
});
