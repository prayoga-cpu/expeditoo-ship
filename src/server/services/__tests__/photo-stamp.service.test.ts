import { describe, it, expect, vi } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

import { photoStampService } from "../photo-stamp.service";

/**
 * Covers docs/specs/shipment_photos_spec.md §5, with real Sharp rather than a
 * mock: the questions here — is EXIF gone, does an ampersand in a street name
 * void the overlay — are exactly the ones a mock would answer wrongly.
 *
 * The glyphs are asserted now that a font ships with the repository. The claim
 * a pixel count can make is host-dependent and worth stating: on Linux, which
 * is what CI and Vercel both run, `FONTCONFIG_PATH` decides the answer and the
 * only face it can reach is the bundled Inter, so lit pixels there mean the
 * bundle worked. macOS answers through CoreText and ignores fontconfig, so the
 * same assertion locally only proves the band is not blank. Neither host can
 * speak for a Vercel function; what they can catch is a font that stopped being
 * found at all.
 */

const FONT_DIR = path.join(process.cwd(), "fonts");

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

/**
 * The band's geometry at 800px wide, read off `buildOverlay`: a 17px face on a
 * 25px line with 15px of padding, so three lines fill the bottom 105px.
 */
const BAND_HEIGHT_800 = 105;

/**
 * Letters are drawn at full white; the band under them is black at 62% over a
 * mid-grey photo, so nothing but a glyph clears 200.
 */
async function litPixels(buffer: Buffer, top: number, height: number) {
  const { data, info } = await sharp(buffer)
    .extract({ left: 0, top, width: 800, height })
    .raw()
    .toBuffer({ resolveWithObject: true });

  let lit = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i] > 200) lit++;
  }
  return lit;
}

describe("the bundled font", () => {
  // The heading line asks for weight 700. With no bold face fontconfig
  // synthesises one, which is a different defect wearing the same face.
  it("ships both of the weights the band asks for", () => {
    expect(existsSync(path.join(FONT_DIR, "Inter-Regular.ttf"))).toBe(true);
    expect(existsSync(path.join(FONT_DIR, "Inter-Bold.ttf"))).toBe(true);
  });

  it("finds the font from the config file rather than the working directory", () => {
    const conf = readFileSync(path.join(FONT_DIR, "fonts.conf"), "utf8");

    // `prefix="relative"` is the whole reason the same file works from a repo
    // checkout, from `next start` and from a function root; a bare <dir> would
    // be read against whatever the process happens to be sitting in.
    expect(conf).toContain('<dir prefix="relative">.</dir>');
    // Inter is the only family present, so the generics have to land on it or
    // a fallback stack naming Helvetica resolves to nothing at all.
    expect(conf).toContain("<family>Inter</family>");
  });
});

describe("the band's text", () => {
  it("draws glyphs rather than an empty bar", async () => {
    const result = await photoStampService.stamp(await photo(800, 600), DETAILS);

    const inBand = await litPixels(
      result.buffer,
      600 - BAND_HEIGHT_800,
      BAND_HEIGHT_800
    );
    // The photo above the band is flat mid-grey. Anything bright up there would
    // mean the count below is measuring something that is not letters.
    const abovePhoto = await litPixels(result.buffer, 200, BAND_HEIGHT_800);

    expect(inBand).toBeGreaterThan(200);
    expect(abovePhoto).toBe(0);
  }, 30_000);

  it("draws the address line when there is one, not just reserves room for it", async () => {
    const source = await photo(800, 600);
    const withAddress = await photoStampService.stamp(source, DETAILS);
    const without = await photoStampService.stamp(source, {
      ...DETAILS,
      address: null,
    });

    const measure = (buffer: Buffer) =>
      litPixels(buffer, 600 - BAND_HEIGHT_800, BAND_HEIGHT_800);

    expect(await measure(withAddress.buffer)).toBeGreaterThan(
      await measure(without.buffer)
    );
  }, 30_000);
});

/**
 * Both branches are read off a fresh module registry rather than off whatever
 * the environment happens to hold when the suite starts. The guard fires once
 * per process, and honouring a value the host already set is half the point of
 * it — so asserting on the ambient variable would fail a machine that is doing
 * exactly what the service asks of it.
 *
 * Last in the file on purpose: fontconfig read the variable during the renders
 * above and kept the answer, so moving it now changes nothing that draws.
 */
async function fontconfigPathAfterImport(preset: string | undefined) {
  const original = process.env.FONTCONFIG_PATH;
  if (preset === undefined) delete process.env.FONTCONFIG_PATH;
  else process.env.FONTCONFIG_PATH = preset;

  try {
    vi.resetModules();
    await import("../photo-stamp.service");
    return process.env.FONTCONFIG_PATH;
  } finally {
    if (original === undefined) delete process.env.FONTCONFIG_PATH;
    else process.env.FONTCONFIG_PATH = original;
  }
}

describe("FONTCONFIG_PATH", () => {
  it("names the bundled directory when the host names none", async () => {
    expect(await fontconfigPathAfterImport(undefined)).toBe(FONT_DIR);
  });

  // A host with its own fonts keeps them. So does one whose working directory
  // is not the project root: the service only claims the variable when there is
  // a `fonts.conf` where it expects one, because a path with nothing behind it
  // costs fontconfig every face it would otherwise have found.
  it("is left alone when the host names one", async () => {
    expect(await fontconfigPathAfterImport("/etc/fonts")).toBe("/etc/fonts");
  });
});
