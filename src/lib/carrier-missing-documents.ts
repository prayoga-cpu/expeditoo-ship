import {
  REQUIRED_DOCUMENT_KINDS,
  type DocumentKind,
} from "@/lib/carrier-constants";

/**
 * Which required documents an application still lacks, in the order the
 * checklist reads, and what to call each in a message to the applicant
 * (client feedback 2026-11-06, B05). Pure: the service, the email and the
 * tests share it.
 */
export function missingRequiredDocuments(
  uploadedKinds: readonly string[]
): DocumentKind[] {
  const have = new Set(uploadedKinds);
  return REQUIRED_DOCUMENT_KINDS.filter((kind) => !have.has(kind));
}

export const DOCUMENT_LABELS: Record<DocumentKind, { fr: string; en: string }> = {
  cni_recto: { fr: "Carte d'identité (recto)", en: "ID card (front)" },
  cni_verso: { fr: "Carte d'identité (verso)", en: "ID card (back)" },
  driving_licence: { fr: "Permis de conduire", en: "Driving licence" },
  kbis: { fr: "Extrait Kbis", en: "Kbis extract" },
  insurance_certificate: { fr: "Attestation d'assurance", en: "Insurance certificate" },
  transport_licence: { fr: "Licence de transport", en: "Transport licence" },
  rib: { fr: "RIB", en: "Bank details (RIB)" },
};
