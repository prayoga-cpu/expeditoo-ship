import { z } from "zod";
import { shipmentPhotoStageEnum } from "@/db/schema/shipments";
import type { ShipmentPhoto } from "@/db/schema/shipments";

/**
 * Derived from the database enum, never restated — the same rule the role enum
 * is under (CLAUDE.md §Gotchas 8). A hand-copied list is how a stage silently
 * stops validating.
 */
export const shipmentPhotoStageSchema = z.enum(
  shipmentPhotoStageEnum.enumValues
);

/**
 * Blank means absent, and absent means refused.
 *
 * This is load-bearing rather than tidy-minded. `z.coerce.number()` turns `""`
 * into `0`, and zero is a perfectly valid latitude and longitude - so a form
 * that posted an empty field would have been accepted as a photo taken in the
 * Gulf of Guinea rather than rejected for having no location at all. The same
 * trap sits under `z.coerce.date()`, where a missing field arrives as `null`
 * and coerces to the epoch.
 *
 * `form.get()` yields `null` for an absent field and `""` for a present but
 * empty one; both are normalised to `undefined` here so the required check
 * fires instead of a coercion.
 */
const absentIfBlank = (schema: z.ZodTypeAny) =>
  z.preprocess(
    (value) =>
      value === null || (typeof value === "string" && value.trim() === "")
        ? undefined
        : value,
    schema
  );

/**
 * What arrives with the bytes.
 *
 * The location is part of the upload, not a later attachment, because the
 * claim the feature makes is that *this* picture was taken *there*. Numbers
 * are coerced: they come off a multipart form, so they arrive as strings.
 */
export const shipmentPhotoCaptureSchema = z.object({
  stage: shipmentPhotoStageSchema,
  lat: absentIfBlank(z.coerce.number().min(-90).max(90)),
  lng: absentIfBlank(z.coerce.number().min(-180).max(180)),
  /**
   * The fix's error radius, when the device reports one. Absent rather than
   * zero when it does not: "±0 m" is a precision claim no phone can make.
   */
  accuracyM: absentIfBlank(
    // `.optional()` belongs *inside* the preprocess. Outside it, Zod only
    // short-circuits on an input that is already `undefined` - a blank string
    // would be normalised and then handed to a required number schema.
    z.coerce.number().min(0).max(100_000).optional()
  ),
  /** The device clock at the fix. Recorded, never trusted, never stamped. */
  capturedAt: absentIfBlank(z.coerce.date()),
});

export type ShipmentPhotoCaptureInput = z.infer<
  typeof shipmentPhotoCaptureSchema
>;

export const shipmentPhotoDeleteSchema = z.object({
  reason: z.string().min(3).max(500),
});

/**
 * What a client sees. `objectKey` is absent by construction rather than by
 * omission: anything holding the key could be presigned against, so the only
 * address a caller ever gets is the authorising route.
 */
export interface ShipmentPhotoView {
  id: string;
  stage: (typeof shipmentPhotoStageEnum.enumValues)[number];
  url: string;
  capturedLat: number;
  capturedLng: number;
  capturedAccuracyM: number | null;
  capturedAddress: string | null;
  capturedAt: string;
  recordedAt: string;
}

export interface ShipmentPhotoGroups {
  pickup: ShipmentPhotoView[];
  delivery: ShipmentPhotoView[];
}

export function toShipmentPhotoView(
  photo: ShipmentPhoto,
  url: string
): ShipmentPhotoView {
  return {
    id: photo.id,
    stage: photo.stage,
    url,
    capturedLat: photo.capturedLat,
    capturedLng: photo.capturedLng,
    capturedAccuracyM: photo.capturedAccuracyM,
    capturedAddress: photo.capturedAddress,
    capturedAt: photo.capturedAt.toISOString(),
    recordedAt: photo.recordedAt.toISOString(),
  };
}

/**
 * Both keys are always present, empty when there is nothing yet. A tracking
 * screen asking "were there pickup photos?" should read an empty array, not
 * discover the key is missing.
 */
export function groupShipmentPhotos(
  photos: ShipmentPhoto[],
  urlFor: (photo: ShipmentPhoto) => string
): ShipmentPhotoGroups {
  const groups: ShipmentPhotoGroups = { pickup: [], delivery: [] };
  for (const photo of photos) {
    groups[photo.stage].push(toShipmentPhotoView(photo, urlFor(photo)));
  }
  return groups;
}
