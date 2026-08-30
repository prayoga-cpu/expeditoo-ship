import { shipmentPhotosService } from "@/server/services/shipment-photos.service";
import { resolveViewer } from "@/server/services/viewer.service";
import { shipmentPhotoCaptureSchema } from "@/server/dto/shipment-photo.dto";
import { ShipmentError } from "@/server/services/shipment-access";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** A phone photo re-encoded through Sharp, plus a Nominatim round trip. */
export const maxDuration = 60;

/**
 * GET /api/shipments/:id/photos
 * Every party to the run, the client included - that is the point of them.
 */
export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();

    const { id } = await params;
    return ok(await shipmentPhotosService.list(id, viewer));
  } catch (error) {
    return handleError(error, "List shipment photos");
  }
}

/**
 * POST /api/shipments/:id/photos
 *
 * Multipart, and deliberately not the two-leg `/api/upload` then attach that
 * proof of delivery used to be: the location and the bytes have to arrive
 * together. An endpoint taking a URL and a location separately is an endpoint
 * that accepts any picture with any location.
 */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();

    const { id } = await params;
    const form = await req.formData();

    /*
     * Duck-typed rather than `instanceof File`. The multipart parser and the
     * page can come from different realms — undici's `File` is not jsdom's,
     * and an `instanceof` across the two is false for a perfectly good upload.
     * What the route actually needs is a blob it can read bytes and a type
     * from, so that is what it checks for.
     */
    const file = form.get("file");
    if (
      !file ||
      typeof file === "string" ||
      typeof (file as Blob).arrayBuffer !== "function"
    ) {
      throw new ShipmentError("NO_FILE", 400, "No photo was sent");
    }
    const blob = file as Blob;

    // Missing, unparseable and out-of-range fixes are one code: the driver's
    // remedy is identical for all three (shipment_photos_spec.md §3.4).
    const parsed = shipmentPhotoCaptureSchema.safeParse({
      stage: form.get("stage"),
      lat: form.get("lat"),
      lng: form.get("lng"),
      accuracyM: form.get("accuracyM") ?? undefined,
      capturedAt: form.get("capturedAt"),
    });
    if (!parsed.success) {
      throw new ShipmentError(
        parsed.error.issues.some((issue) => issue.path[0] === "stage")
          ? "PHOTO_STAGE_NOT_OPEN"
          : "LOCATION_REQUIRED",
        400,
        "A live location is required for every shipment photo"
      );
    }

    const photo = await shipmentPhotosService.capture(
      id,
      parsed.data,
      {
        buffer: Buffer.from(await blob.arrayBuffer()),
        mimeType: blob.type,
      },
      viewer
    );

    return ok(photo, 201);
  } catch (error) {
    return handleError(error, "Capture shipment photo");
  }
}
