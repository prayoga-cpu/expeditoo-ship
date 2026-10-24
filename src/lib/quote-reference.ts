/**
 * Our number for an Expedion quote, « DEV-04659 »
 * (client_feedback_2026_10_21_spec.md §A3).
 *
 * Issued by `expedion_quote_reference_seq` (migration 0040); nothing here mints
 * one. "DEV" is for *devis*, and the prefix is what keeps it apart from the two
 * other numbers an operator sees beside it: the Airtable « Numéro Devis »
 * (bare digits, 11119) and a job's « Réf. 100042 » (six digits).
 */

const PREFIX = "DEV-";
const WIDTH = 5;

export function formatQuoteReference(value: number): string {
  return `${PREFIX}${String(value).padStart(WIDTH, "0")}`;
}

/** The number a typed « DEV-04659 » / « dev 4659 » names, or null. */
export function parseQuoteReference(input: string): number | null {
  const match = /^\s*dev[\s-]*0*(\d{1,9})\s*$/iu.exec(input);
  if (!match) return null;
  const value = Number(match[1]);
  return value > 0 ? value : null;
}
