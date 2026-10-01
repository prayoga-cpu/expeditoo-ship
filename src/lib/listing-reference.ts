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

/**
 * The reference an input names, or null when it names none.
 *
 * Tolerates the prefix and the spaces people add when they read a number
 * back (« 100 042 »). Anything else — a letter, a five-digit number, a
 * number the sequence cannot have issued — is not a reference, and the
 * caller searches the text as text.
 */
export function parseListingReference(input: string): number | null {
  const bare = input.trim().replace(PREFIX, "").replace(/\s+/g, "");
  if (!/^\d{6,10}$/.test(bare)) return null;

  const value = Number(bare);
  return value >= FIRST_LISTING_REFERENCE && value <= MAX_LISTING_REFERENCE
    ? value
    : null;
}
