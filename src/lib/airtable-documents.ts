/**
 * Which Airtable attachment column becomes which kind of stored document, and
 * the deterministic key each one is stored under.
 *
 * Pure on purpose (no database, no storage): the importer
 * (`src/scripts/import-airtable-documents.ts`) and its tests share it.
 */

export type DocumentKind =
  | "bordereau"
  | "invoice"
  | "procuration"
  | "photo"
  | "proof";

interface FieldRule {
  kind: DocumentKind;
  /** The first of these on a quote also becomes `bordereau_doc_url`. */
  primary?: boolean;
}

/** Airtable `CONTACTS` columns that hold attachments, as they are named there. */
export const ATTACHMENT_FIELDS: Record<string, FieldRule> = {
  "Bordereaux (document)": { kind: "bordereau", primary: true },
  "BORDEREAU 2 doc": { kind: "bordereau" },
  "FACTURE EDITION": { kind: "invoice" },
  "PROCURATION DOC": { kind: "procuration" },
  Images: { kind: "photo" },
  "Image d'achat": { kind: "proof" },
  "preuve d'achat": { kind: "proof" },
  "IMAGE preuve de depot": { kind: "photo" },
  "photos retrait": { kind: "photo" },
  "Photos livraison": { kind: "photo" },
  "photos emballage": { kind: "photo" },
};

/**
 * Identity documents. Personal data the platform has no use for, so they are
 * left in Airtable unless someone asks for them explicitly.
 */
export const IDENTITY_FIELD = "Piece d'Identité";

export interface AirtableAttachment {
  id: string;
  url: string;
  filename?: string;
  type?: string;
  size?: number;
}

export interface PlannedDocument {
  field: string;
  kind: DocumentKind;
  primary: boolean;
  attachment: AirtableAttachment;
  objectKey: string;
}

/** Same private prefix as `expedionStorageService`, in its own sub-folder. */
export function objectKeyFor(recordId: string, attachmentId: string): string {
  return `expedion/airtable/${recordId}/${attachmentId}`;
}

const isAttachment = (value: unknown): value is AirtableAttachment =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as AirtableAttachment).id === "string" &&
  typeof (value as AirtableAttachment).url === "string";

/** Every attachment on one Airtable record that this import stores. */
export function planDocuments(
  recordId: string,
  fields: Record<string, unknown>,
  options: { includeIdentity?: boolean } = {}
): PlannedDocument[] {
  const planned: PlannedDocument[] = [];
  const seen = new Set<string>();

  const rules: [string, FieldRule][] = Object.entries(ATTACHMENT_FIELDS);
  if (options.includeIdentity) rules.push([IDENTITY_FIELD, { kind: "proof" }]);

  for (const [field, rule] of rules) {
    const value = fields[field];
    if (!Array.isArray(value)) continue;
    for (const attachment of value.filter(isAttachment)) {
      // The same file can sit in two columns; it is stored once.
      if (seen.has(attachment.id)) continue;
      seen.add(attachment.id);
      planned.push({
        field,
        kind: rule.kind,
        primary: Boolean(rule.primary),
        attachment,
        objectKey: objectKeyFor(recordId, attachment.id),
      });
    }
  }
  return planned;
}

/** A content type the stored object can carry; Airtable's is usually right. */
export function mimeFor(attachment: AirtableAttachment): string {
  if (attachment.type && /^[\w.+-]+\/[\w.+-]+$/.test(attachment.type)) {
    return attachment.type;
  }
  const name = (attachment.filename ?? "").toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (/\.jpe?g$/.test(name)) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}
