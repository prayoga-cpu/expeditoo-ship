/**
 * The public image store's refusals, carrying a `code` and a `status` for
 * `handleError` to translate.
 *
 * Its own module on purpose. `api-response.ts` is imported by every route, and
 * importing the error from `storage.service.ts` would pull the S3 client into
 * the graph of all of them — the same cold-start cost `invoice-email.service.ts`
 * documents for the PDF renderer.
 */
export class StorageError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message?: string
  ) {
    super(message ?? code);
    this.name = "StorageError";
  }
}
