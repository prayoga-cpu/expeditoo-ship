/**
 * The built-in illustrations a request can carry when it has no photo
 * (client feedback 2026-11-06, A07): four generic pictures, labelled as such
 * everywhere, never applied unless the requester accepts one.
 *
 * Client-safe and pure — the form, the cards and the DTO share it.
 */
export const ILLUSTRATION_KINDS = ["furniture", "parcel", "pallet", "vehicle"] as const;
export type IllustrationKind = (typeof ILLUSTRATION_KINDS)[number];

export const illustrationSrc = (kind: IllustrationKind) => `/images/illustrations/${kind}.svg`;

// Matched against the title with accents stripped and lower-cased, so « Canapé »
// and « canape » are one word and `\b` means what it says.
const WORDS: Record<Exclude<IllustrationKind, "parcel">, RegExp> = {
  vehicle: /\b(voiture|auto|moto|scooter|velo|bike|car|van|camion|truck|caravane|remorque|bateau|boat)\b/,
  pallet: /\b(palettes?|pallets?|cartons?|caisses?|crates?|machine|moteur|stock)\b/,
  furniture:
    /\b(canape|sofa|table|chaises?|chairs?|armoire|commode|buffet|bureau|desk|lit|bed|matelas|mattress|meubles?|furniture|baby ?foot|piano|bibliotheque|tapis|rug|etagere|fauteuil|cuisine|frigo|lave)\b/,
};

const plain = (text: string) =>
  text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** The best of the four for a title; a parcel when nothing matches. */
export function guessIllustration(title: string, description = ""): IllustrationKind {
  const text = plain(`${title} ${description}`);
  for (const kind of ["vehicle", "pallet", "furniture"] as const) {
    if (WORDS[kind].test(text)) return kind;
  }
  return "parcel";
}
