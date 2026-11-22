import {
  DEFAULT_COUNTRY,
  countryCodeFrom,
  isPostalCodeRequired,
  isValidPostalCode,
} from "@/lib/countries";

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

/**
 * The country an Expedion quote delivers to. Free text in the quote
 * (« Belgique », « USA », blank); blank or unrecognised was always read as
 * France (client_feedback_2026_10_31_spec.md §0 B).
 */
export function quoteDeliveryCountry(text: string | null | undefined): string {
  return countryCodeFrom(text) ?? DEFAULT_COUNTRY;
}

/**
 * The postal code an escalated quote's end stores on its listing, or null
 * when the quote cannot be published with what it holds.
 *
 * Two rules, and neither is written here — both are the listing's own
 * (`countries.ts`, enforced by `endpointSchema`):
 *
 * - a country whose format is known (the fourteen of `FREQUENT_COUNTRIES`)
 *   needs its 4–6 digits, read out of whatever the quote typed;
 * - anywhere else the code is optional — not every country has postal codes —
 *   and is kept as written (« SW1A 1AA ») or stored as `''` when absent.
 *
 * Until 2.95.0 the first rule was applied to every country, so a paid quote
 * for London or Hong Kong read « postal code missing » forever
 * (postal_codes_abroad_spec.md §5).
 */
export function quotePostalCodeFor(
  country: string | null | undefined,
  value: string | null | undefined
): string | null {
  if (isPostalCodeRequired(country)) return normaliseJobPostalCode(value);
  const code = (value ?? "").trim();
  return isValidPostalCode(country, code) ? code : null;
}
