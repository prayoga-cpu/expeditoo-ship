/**
 * Postal codes on a job — where goods are collected and where they go.
 *
 * Four to six digits: 4 in Belgium, Switzerland, Austria and Luxembourg, 5 in
 * France, Germany, Italy and Spain, 6 in Romania. A job's pickup or delivery can
 * be abroad even though the carrier is a French business, and Expedion's own
 * quotes say so — 317 of them deliver to a 4-digit code and 53 to a 6-digit one
 * (docs/specs/postal_codes_abroad_spec.md).
 *
 * Not the rule for a driver's own address: that is a French business with a
 * SIRET, and stays on `POSTAL_CODE_PATTERN` in `french-identifiers.ts`.
 */
export const JOB_POSTAL_CODE_PATTERN = /^\d{4,6}$/;

/**
 * The digits of a free-typed code, or null when they are not a job postal
 * code. Separators are dropped so "L-1234" and "010 011" survive an import.
 * Letters go with them: a Dutch "1012 AB" keeps its four area digits (the
 * street is on the address line beside it), and a UK "SW1A 1AA" comes out as
 * two digits and is refused.
 */
export function normaliseJobPostalCode(
  value: string | null | undefined
): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return JOB_POSTAL_CODE_PATTERN.test(digits) ? digits : null;
}
