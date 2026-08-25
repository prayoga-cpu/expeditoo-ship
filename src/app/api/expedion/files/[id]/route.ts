/**
 * GET /api/expedion/files/:id
 *
 * Serves one uploaded bordereau or lot photo to its owner, or to an admin.
 *
 * This is the read half of the private-storage move. The object itself has no
 * public URL — the whole point — so this route is what the persisted
 * `bordereau_doc_url` points at, and it is where authorisation happens.
 *
 * `requireExpedionCaller` tries a Better Auth *cookie* session first, which is
 * what makes this work in two places at once with no extra plumbing: the
 * admin's browser is same-origin, so the `<img>` and `<iframe>` in the quote
 * detail dialog authenticate on their own cookies, while the Flutter client
 * presents the bearer token it already sends everywhere else.
 *
 * The answer is a 302 to a presigned URL rather than the bytes. The redirect
 * keeps multi-megabyte PDFs out of the function's response budget, and
 * `<img>`/`<iframe>`/`<a target=_blank>` all follow it without knowing
 * anything changed. The URL it redirects to lives five minutes; that is
 * deliberately far too short to be worth saving, which is the difference
 * between this and the Firebase `?token=…` links it replaces.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireExpedionCaller } from "@/lib/expedion-auth";
import { expedionErrorResponse } from "@/lib/expedion-response";
import { ExpedionError } from "@/server/services/expedion.service";
import { expedionFilesDal } from "@/server/dal/expedion-files.dal";
import { expedionStorageService } from "@/server/services/expedion-storage.service";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireExpedionCaller(req);
    const { id } = await params;

    const file = await expedionFilesDal.getById(id);

    /*
     * 404 for "no such file" and 404 for "not yours", matching `getQuote`'s
     * rule: a non-owner should not learn the id exists. Ids are `nanoid()`, so
     * there is nothing to enumerate anyway — but the two cases answering
     * differently is precisely how you turn an unguessable id into a guessable
     * one, and it costs nothing to keep them identical.
     */
    if (!file || (!caller.isAdmin && file.ownerUserId !== caller.userId)) {
      throw new ExpedionError("FILE_NOT_FOUND", 404, "Document introuvable");
    }

    const url = await expedionStorageService.presignRead(file.objectKey);

    return NextResponse.redirect(url, {
      status: 302,
      headers: {
        // The redirect target is short-lived and caller-specific. A shared
        // cache holding it would hand the next reader a link that skipped this
        // check entirely.
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return expedionErrorResponse(error);
  }
}
