import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { carrierService } from "@/server/services/carrier.service";
import { kycStorageService } from "@/server/services/kyc-storage.service";
import {
  DOCUMENT_KINDS,
  ACCEPTED_DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_BYTES,
} from "@/server/dto/carrier.dto";
import { ok, unauthorised, handleError, fail } from "@/lib/api-response";

/**
 * POST /api/carrier/documents
 *
 * Takes the file directly rather than a pre-uploaded URL, so a KYC document
 * never transits the public upload path (carrier_kyc_spec.md §4).
 */
export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const carrier = await carrierService.requireOwnCarrier(session.user.id);

    const form = await req.formData();
    const file = form.get("file");
    const kind = String(form.get("kind") ?? "");
    const expiresAtRaw = form.get("expiresAt");

    if (!(file instanceof File)) {
      return fail("FILE_REQUIRED", "A file is required", 400);
    }
    if (!(DOCUMENT_KINDS as readonly string[]).includes(kind)) {
      return fail("INVALID_DOCUMENT_KIND", "Unknown document kind", 400);
    }
    if (!(ACCEPTED_DOCUMENT_MIME_TYPES as readonly string[]).includes(file.type)) {
      return fail(
        "UNSUPPORTED_DOCUMENT_TYPE",
        "Only PDF, JPEG and PNG are accepted",
        400
      );
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      return fail("DOCUMENT_TOO_LARGE", "Maximum size is 10 MB", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const objectKey = await kycStorageService.upload(
      carrier.id,
      kind,
      buffer,
      file.type
    );

    const document = await carrierService.uploadDocument(session.user.id, {
      kind: kind as (typeof DOCUMENT_KINDS)[number],
      objectKey,
      mimeType: file.type as (typeof ACCEPTED_DOCUMENT_MIME_TYPES)[number],
      sizeBytes: file.size,
      expiresAt: expiresAtRaw ? new Date(String(expiresAtRaw)) : undefined,
    });

    // The key is internal; the client gets identity and status only.
    return ok(
      {
        id: document.id,
        kind: document.kind,
        status: document.status,
        expiresAt: document.expiresAt,
      },
      201
    );
  } catch (error) {
    return handleError(error, "Upload carrier document");
  }
}
