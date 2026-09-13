import { storageService } from "@/server/services/storage.service";
import { handleError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ key: string[] }>;
}

/**
 * GET /api/images/[...key]
 * One public image — a listing photo, an incident photo, a feedback
 * screenshot, a profile picture — served from the public bucket.
 *
 * Why the app serves these instead of a CDN: `R2_PUBLIC_URL` pointed at
 * `cdn.prayoga.io`, a hostname with no DNS record at all. Every upload
 * succeeded, every URL it produced was dead, and every preview in the app was a
 * broken image. Pointing `R2_PUBLIC_URL` here makes the URLs work with nothing
 * to configure outside this repository; the day a real domain is bound to the
 * bucket, changing the variable back is the whole migration.
 *
 * Public by design — these objects always had permanent public URLs. Private
 * files (KYC, shipment photos, Expedion bordereaux) live in other buckets and
 * are only ever reachable through short-lived presigned links; this route can
 * reach none of them.
 */

/**
 * Keys are `<owner>/<nanoid>.<ext>`: a new upload is always a new key, so a
 * copy cached at the edge or in a browser can never go stale. That is what
 * makes serving images through a function cheap — each one is fetched from R2
 * once per edge location, not once per view.
 */
const CACHE_FOREVER = "public, max-age=31536000, s-maxage=31536000, immutable";

/**
 * Stored bytes served from the app's own origin. `nosniff` stops a browser
 * guessing a different type, and the sandboxed CSP means an image opened in its
 * own tab can run nothing even if one ever were not what it claims.
 */
const CONTENT_POLICY = "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox";

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { key } = await params;
    const image = await storageService.readImage(key.join("/"));

    const headers = new Headers({
      "Content-Type": image.contentType ?? "application/octet-stream",
      "Cache-Control": CACHE_FOREVER,
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": CONTENT_POLICY,
    });
    if (image.contentLength !== null) {
      headers.set("Content-Length", String(image.contentLength));
    }

    return new Response(image.body, { status: 200, headers });
  } catch (error) {
    return handleError(error, "GET /api/images");
  }
}
