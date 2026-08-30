import { NextResponse } from "next/server";
import { shipmentPhotosService } from "@/server/services/shipment-photos.service";
import { resolveViewer } from "@/server/services/viewer.service";
import { shipmentPhotoDeleteSchema } from "@/server/dto/shipment-photo.dto";
import { ok, unauthorised, handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string; photoId: string }>;
}

export const dynamic = "force-dynamic";

/**
 * GET /api/shipments/:id/photos/:photoId
 *
 * Authorise, then 302 to a five-minute presigned URL - the same shape as
 * `/api/expedion/files/:id`, and for the same reasons: the redirect keeps
 * multi-megabyte images out of the function's response budget, and an `<img>`
 * follows it without knowing anything happened.
 */
export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();

    const { id, photoId } = await params;
    const url = await shipmentPhotosService.presign(id, photoId, viewer);

    return NextResponse.redirect(url, {
      status: 302,
      headers: {
        // Short-lived and caller-specific. A shared cache holding it would
        // hand the next reader a link that skipped the check entirely.
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleError(error, "Read shipment photo");
  }
}

/**
 * DELETE /api/shipments/:id/photos/:photoId
 *
 * Admin only, and soft - see shipment_photos_spec.md §6.3. There is no PATCH
 * beside this one, and that is not an omission: a photo's image, location and
 * timestamps have no update path anywhere in the stack.
 */
export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();

    const { id, photoId } = await params;
    // A removal has to say why, so `reason` is required rather than optional.
    const { reason } = shipmentPhotoDeleteSchema.parse(
      await req.json().catch(() => ({}))
    );

    return ok(await shipmentPhotosService.remove(id, photoId, reason, viewer));
  } catch (error) {
    return handleError(error, "Remove shipment photo");
  }
}
