/**
 * Carrier vocabulary shared by the client and the server.
 *
 * These lists drive both the Zod schemas in `src/server/dto/carrier.dto.ts` and
 * the carrier screens, so they live outside `src/server/**` — a client bundle
 * must never have to import a server module to know the document kinds.
 * See docs/specs/carrier_kyc_spec.md §3.
 */

export const VEHICLE_TYPES = [
  "motorcycle",
  "car",
  "van",
  "truck_3_5t",
  "truck_7_5t",
  "truck_19t",
  "semi_trailer",
  "flatbed",
  "refrigerated",
] as const;

export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const DOCUMENT_KINDS = [
  "cni_recto",
  "cni_verso",
  "driving_licence",
  "kbis",
  "insurance_certificate",
  "transport_licence",
  "rib",
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/**
 * Every application must carry these before it can be submitted.
 *
 * Person-level: applicants are individual drivers, not haulage companies. The
 * KBIS — the registry extract for a registered company — is therefore no longer
 * required, because an auto-entrepreneur simply does not have one; theirs is an
 * avis de situation SIRENE. It stays in `DOCUMENT_KINDS` so anyone who already
 * uploaded one keeps a valid document, and so a company applicant can still
 * supply it.
 *
 * SIRET is deliberately still required elsewhere: a sole trader carrying goods
 * for hire in France has one, and the column is NOT NULL.
 */
export const REQUIRED_DOCUMENT_KINDS = [
  "cni_recto",
  "cni_verso",
  "driving_licence",
  "insurance_certificate",
  "rib",
] as const;

/** Documents that go stale and drive the expiry cron. */
export const EXPIRING_DOCUMENT_KINDS = [
  "driving_licence",
  "insurance_certificate",
  "transport_licence",
] as const;

export const ACCEPTED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
