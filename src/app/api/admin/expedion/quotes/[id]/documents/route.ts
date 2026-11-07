import { ok, unauthorised, handleError } from "@/lib/api-response";
import { listQuoteDocuments } from "@/server/services/expedion-report.service";
import { resolveViewer } from "@/server/services/viewer.service";

/**
 * GET /api/admin/expedion/quotes/:id/documents — every document filed with a
 * quote (bordereaux, invoices, powers of attorney, photos), the Airtable
 * import's included, for the quote detail's « Documents » section.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();
    const { id } = await params;
    return ok(await listQuoteDocuments(viewer, id));
  } catch (error) {
    return handleError(error, "Admin list quote documents");
  }
}
