import sharp from "sharp";
import type { ShipmentPhotoStage } from "@/db/schema/shipments";

/**
 * Burns the location and the time into the bottom of a shipment photo.
 *
 * Why the pixels and not only the database row: a photo travels. It gets
 * screenshotted into an email, forwarded to an insurer, pasted into a claim.
 * The row is authoritative but does not travel with the image, and an image
 * with no context is an image anyone can say anything about.
 *
 * The stamp happens before the object is stored, so there is never an
 * unstamped copy anywhere. Sharp also re-encodes to WebP, which drops the
 * metadata block — the device's own EXIF GPS tags included. Those are editable
 * with a text editor and are deliberately not read; the coordinates that get
 * stamped are the live fix the client posted alongside the bytes.
 *
 * TODO(EXPEDITOO-TESTING): librsvg finds fonts through fontconfig, i.e.
 * through whatever the host provides. This renders correctly in local
 * development; on a host with no system fonts the band renders without glyphs.
 * The fix is to bundle a TTF and point `FONTCONFIG_PATH` at it, which is a
 * decision about licensing and bundle size rather than about code. The
 * database row is unaffected, and every surface renders the same three lines
 * as text beside the photo, so a fontless deployment loses the convenience and
 * not the evidence. See shipment_photos_spec.md §5.4.
 */

/** French, because the stamp is evidence for a French market. */
const STAGE_LABEL: Record<ShipmentPhotoStage, string> = {
  pickup: "RETRAIT",
  delivery: "LIVRAISON",
};

const MAX_EDGE = 1920;

export interface StampInput {
  stage: ShipmentPhotoStage;
  lat: number;
  lng: number;
  accuracyM?: number | null;
  /** The address, when a geocoder could name one. Omitted from the band when not. */
  address?: string | null;
  /** The server's clock. Never the device's — see shipment_photos_spec.md §2.1. */
  recordedAt: Date;
  /** Short shipment reference, so a loose photo can be traced back. */
  shipmentRef: string;
}

/** SVG is XML: a street name containing `&` would otherwise void the overlay. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Five decimals is about a metre — past that the GPS fix is the limit, not us. */
const coord = (value: number) => value.toFixed(5);

function bandLines(input: StampInput): string[] {
  const when = dateFormatter.format(input.recordedAt);
  const accuracy =
    typeof input.accuracyM === "number" && Number.isFinite(input.accuracyM)
      ? ` · ±${Math.round(input.accuracyM)} m`
      : "";

  const lines = [
    `${STAGE_LABEL[input.stage]} · ${when} (Europe/Paris)`,
    // A blank line is honest; "Unknown location" reads like a failure of the
    // evidence rather than of a geocoder, so the line is dropped entirely.
    input.address?.trim() || null,
    `${coord(input.lat)}, ${coord(input.lng)}${accuracy} · ${input.shipmentRef}`,
  ];

  return lines.filter((line): line is string => !!line);
}

/**
 * A translucent band across the bottom, sized from the image so the stamp is
 * equally readable on a 900px phone capture and a 1920px one.
 */
function buildOverlay(width: number, lines: string[]): Buffer {
  const fontSize = Math.max(13, Math.round(width / 46));
  const lineHeight = Math.round(fontSize * 1.45);
  const padding = Math.round(fontSize * 0.9);
  const height = padding * 2 + lineHeight * lines.length;

  const text = lines
    .map((line, index) => {
      const y = padding + lineHeight * (index + 1) - Math.round(fontSize * 0.3);
      const weight = index === 0 ? "700" : "400";
      const opacity = index === 0 ? "1" : "0.92";
      return `<text x="${padding}" y="${y}" font-family="DejaVu Sans, Verdana, Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="${weight}" fill="#ffffff" fill-opacity="${opacity}">${escapeXml(line)}</text>`;
    })
    .join("");

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<rect width="${width}" height="${height}" fill="#000000" fill-opacity="0.62"/>` +
      text +
      `</svg>`
  );
}

export const photoStampService = {
  /**
   * Auto-orient, bound the edges, burn the band in, encode WebP.
   *
   * `.rotate()` with no argument applies the EXIF orientation before the
   * metadata is dropped — without it, a portrait phone photo gets its stamp
   * across what turns out to be the side.
   */
  async stamp(
    input: Buffer,
    details: StampInput
  ): Promise<{ buffer: Buffer; mimeType: string; sizeBytes: number }> {
    const resized = await sharp(input)
      .rotate()
      .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
      .toBuffer({ resolveWithObject: true });

    const overlay = buildOverlay(resized.info.width, bandLines(details));

    const stamped = await sharp(resized.data)
      .composite([{ input: overlay, gravity: "south" }])
      .webp({ quality: 82 })
      .toBuffer();

    return {
      buffer: stamped,
      mimeType: "image/webp",
      sizeBytes: stamped.byteLength,
    };
  },
};
