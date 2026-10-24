/**
 * The job reference, « Réf. 100042 » (docs/specs/listing_reference_spec.md).
 *
 * The number itself is issued by the database — `listing_reference_seq`,
 * migration 0033 — so nothing here mints one. What lives here is reading one
 * back out of what a person typed into a search box.
 */

/** The first reference the sequence issues. Nothing below it exists. */
export const FIRST_LISTING_REFERENCE = 100_001;

/** Postgres `integer`, the column's type. */
const MAX_LISTING_REFERENCE = 2_147_483_647;

// « Réf. », « référence : », "ref #", « N° », « no », "#" — the ways people
// write "reference" in front of a number, in either language, in any case.
const PREFIX = /^(?:r[ée]f(?:[ée]rence)?|n[°o]|#)\.?\s*[:#-]?\s*/iu;

// « PAR-CLA- » in front of the number: the route letters `formatListingReference`
// writes (client_feedback_2026_10_21_spec.md §A4). Read back and dropped — the
// number alone identifies the job.
const ROUTE_CODE = /^[a-z]{2,3}\s*-\s*[a-z]{2,3}\s*-\s*/iu;

/**
 * Three capital letters for a city, accents and spaces dropped: « Paris » →
 * PAR, « Évry » → EVR, « Le Havre » → LEH. Null when there is nothing to read.
 */
export function cityCode(city: string | null | undefined): string | null {
  if (!city) return null;
  const letters = city
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z]/giu, "")
    .toUpperCase();
  return letters.length >= 2 ? letters.slice(0, 3) : null;
}

/**
 * The reference as people read it: « PAR-CLA-100018 », departure and arrival
 * letters in front of the number (client feedback 2026-10-21, §A4). The letters
 * are a reading aid, not part of the identity — a job keeps its number if its
 * address is corrected, the search takes the number with or without them, and
 * copying copies the number. Without both cities it is the number alone.
 */
export function formatListingReference(
  reference: number,
  from?: string | null,
  to?: string | null
): string {
  const a = cityCode(from);
  const b = cityCode(to);
  return a && b ? `${a}-${b}-${reference}` : String(reference);
}

/**
 * The reference an input names, or null when it names none.
 *
 * Tolerates the prefix and the spaces people add when they read a number
 * back (« 100 042 »). Anything else — a letter, a five-digit number, a
 * number the sequence cannot have issued — is not a reference, and the
 * caller searches the text as text.
 */
export function parseListingReference(input: string): number | null {
  const bare = input
    .trim()
    .replace(PREFIX, "")
    .replace(ROUTE_CODE, "")
    .replace(/\s+/g, "");
  if (!/^\d{6,10}$/.test(bare)) return null;

  const value = Number(bare);
  return value >= FIRST_LISTING_REFERENCE && value <= MAX_LISTING_REFERENCE
    ? value
    : null;
}
