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

// « PAR-CLA- » in front of the number: the route letters 2.65.0 printed
// (client_feedback_2026_10_21_spec.md §A4) and 2.66.0 dropped again
// (client_feedback_2026_10_29_spec.md §A4). Still read back and dropped, so a
// reference copied off an old screen, an email or a screenshot finds its job.
const ROUTE_CODE = /^[a-z]{2,3}\s*-\s*[a-z]{2,3}\s*-\s*/iu;

/**
 * The reference as people read it: the number alone, « 100018 »
 * (client_feedback_2026_10_29_spec.md §A4). The client asked for the route
 * letters on 21 October and took them back on 28 October: the cities and the
 * requester sit in their own columns on the staff screens instead, and a
 * reference that changes when an address is corrected is not a reference.
 */
export function formatListingReference(reference: number): string {
  return String(reference);
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
