import { changelogService } from "@/server/services/changelog.service";
import { handleError, ok } from "@/lib/api-response";

/**
 * GET /api/public/changelog
 *
 * The release history, newest first. Public and unauthenticated by design —
 * this is published product news, and it is what the Flutter client reads to
 * show "what's new" without shipping a second copy of the text.
 *
 * Prerendered at build time. `changelogService` reads `CHANGELOG.md` off disk,
 * and a statically rendered route does that read once, during `next build`,
 * rather than on every request from a serverless function whose bundle is not
 * guaranteed to carry the file at all.
 *
 * The corollary: the history only changes on deploy. That is correct — a
 * release *is* a deploy.
 */
export const dynamic = "force-static";

export async function GET() {
  try {
    return ok({
      version: changelogService.getCurrentVersion(),
      releases: changelogService.getReleases(),
    });
  } catch (error) {
    return handleError(error, "Changelog");
  }
}
