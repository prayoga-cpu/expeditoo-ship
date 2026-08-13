import { carriersDal } from "@/server/dal/carriers.dal";
import { resolveViewer } from "@/server/services/viewer.service";
import { kycStorageService } from "@/server/services/kyc-storage.service";
import { ok, unauthorised, handleError, fail } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/carrier/documents/:id
 *
 * Returns a presigned URL valid for five minutes. The document is never
 * reachable by a stable public URL (carrier_kyc_spec.md §4.2).
 */
export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return unauthorised();

    const { id } = await params;
    const document = await carriersDal.getDocumentById(id);
    if (!document) return fail("DOCUMENT_NOT_FOUND", "Not found", 404);

    const carrier = await carriersDal.getById(document.carrierId);
    const isOwner = carrier?.userId === viewer.userId;
    if (!isOwner && !viewer.isAdmin) {
      return fail("FORBIDDEN", "Not permitted", 403);
    }

    const url = await kycStorageService.presignRead(document.objectKey);

    return ok({ url, expiresInSeconds: 300 });
  } catch (error) {
    return handleError(error, "Get carrier document");
  }
}
