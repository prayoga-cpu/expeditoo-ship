/**
 * Validators for the business and banking identifiers collected during
 * carrier onboarding (docs/specs/carrier_kyc_spec.md §3).
 *
 * The file is named for where it started. A carrier may be registered outside
 * France (driver_types_spec.md §8), so the rules a driver's file is held to —
 * company number, contact phone, postal code, VAT, plate — take the French
 * form *or* a plain international one. The strictly French rules
 * (`isValidSiret`, `isValidFrenchPhone`, `POSTAL_CODE_PATTERN`,
 * `PLATE_PATTERN`) stay exported for the callers that mean France.
 *
 * None of these are registry lookups: a well-formed identifier belonging to
 * nobody still passes. Confirming the company actually exists is the admin
 * reviewer's job. IBAN and BIC also carry a real checksum; SIRET is a format
 * check only (exactly 14 digits) — see carrier_kyc_spec.md §3 for why the
 * Luhn check was dropped.
 */

/** A SIRET is 14 digits. */
export function isValidSiret(raw: string): boolean {
  return /^\d{14}$/.test(raw.replace(/\s+/g, ""));
}

/** Strips the grouping spaces a SIRET is conventionally printed with. */
export const normalizeSiret = (raw: string) => raw.replace(/\s+/g, "");

/**
 * A company registration number as it is stored and compared: no spaces, dots
 * or dashes, upper case — so « BE 0123.456.789 » and « be0123456789 » are one
 * company to the uniqueness check.
 */
export const normalizeCompanyNumber = (raw: string) =>
  raw.replace(/[\s.-]/g, "").toUpperCase();

/**
 * A SIRET, or a foreign company number: 5 to 20 letters and digits once the
 * separators are gone. Fourteen digits is a SIRET; nothing else is checked,
 * because no two registries agree on a format.
 */
export const isValidCompanyNumber = (raw: string) =>
  /^[A-Z0-9]{5,20}$/.test(normalizeCompanyNumber(raw));

/** A SIRET is printed 3-3-3-5; any other number is shown as it was typed. */
export function formatCompanyNumber(raw: string): string {
  const compact = normalizeCompanyNumber(raw);
  if (!/^\d{14}$/.test(compact)) return raw.trim();
  return [compact.slice(0, 3), compact.slice(3, 6), compact.slice(6, 9), compact.slice(9)].join(" ");
}

/**
 * IBAN mod-97 check (ISO 13616). A French IBAN is 27 characters, but the
 * checksum itself is length-agnostic, so the length is asserted separately.
 */
export function isValidIban(raw: string): boolean {
  const iban = raw.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)) return false;
  if (iban.startsWith("FR") && iban.length !== 27) return false;

  // Move the first four characters to the end, then map letters to numbers.
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (c) =>
    String(c.charCodeAt(0) - 55)
  );

  // The value overflows Number, so the modulo is taken in chunks.
  let remainder = 0;
  for (const digit of numeric) {
    remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

export const BIC_PATTERN = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
export const isValidBic = (bic: string) => BIC_PATTERN.test(bic.toUpperCase());

/** Post-2009 French plate format, e.g. AB-123-CD. */
export const PLATE_PATTERN = /^[A-Z]{2}-\d{3}-[A-Z]{2}$/;

/** Any country's plate: 4 to 12 letters and digits, single spaces or dashes between. */
export const ANY_PLATE_PATTERN = /^(?=.{4,12}$)[A-Z0-9]+(?:[ -][A-Z0-9]+)*$/;

/** The French format, or a foreign plate (`ANY_PLATE_PATTERN`). Case is ignored. */
export function isValidPlate(raw: string): boolean {
  const plate = raw.trim().toUpperCase();
  return PLATE_PATTERN.test(plate) || ANY_PLATE_PATTERN.test(plate);
}

/** Accepts 0X XX XX XX XX and +33 X XX XX XX XX, with or without spacing. */
export function isValidFrenchPhone(raw: string): boolean {
  const phone = raw.replace(/[\s.-]/g, "");
  return /^(?:\+33|0)[1-9]\d{8}$/.test(phone);
}

const FRENCH_PREFIX = /^(?:\+33|0)(?=[1-9]\d{8}$)/;

/**
 * How to reach a driver: a French number as above, or an international one —
 * `+` and 8 to 15 digits (E.164). A `+33` number must still be a French one.
 */
export function isValidContactPhone(raw: string): boolean {
  const phone = raw.replace(/[\s.()-]/g, "");
  if (isValidFrenchPhone(phone)) return true;
  return /^\+\d{8,15}$/.test(phone) && !phone.startsWith("+33");
}

/**
 * The phone as it is saved: a French number becomes « +33 6 12 34 56 78 »
 * whichever way it was typed, an international one keeps its `+` and digits.
 * Anything `isValidContactPhone` refuses comes back trimmed and untouched.
 */
export function normalizeContactPhone(raw: string): string {
  const phone = raw.replace(/[\s.()-]/g, "");
  if (!isValidContactPhone(phone)) return raw.trim();
  if (!FRENCH_PREFIX.test(phone)) return phone;
  const national = phone.replace(FRENCH_PREFIX, "");
  return `+33 ${national[0]} ${national.slice(1).match(/\d{2}/g)?.join(" ") ?? ""}`;
}

/** A VAT number as stored: no spaces or dots, upper case. */
export const normalizeVat = (raw: string) => raw.replace(/[\s.]/g, "").toUpperCase();

/** Two letters for the country, then 2 to 13 letters and digits (FR, BE, DE, NL…). */
export const VAT_PATTERN = /^[A-Z]{2}[0-9A-Z]{2,13}$/;
export const isValidVat = (raw: string) => VAT_PATTERN.test(normalizeVat(raw));

/** A French postal code. Still the rule for a declared trajet (carrier-routes.dto). */
export const POSTAL_CODE_PATTERN = /^\d{5}$/;

/**
 * The postal code of a driver's own address, in any country: 3 to 10 letters
 * and digits, single spaces or dashes between (« 69000 », « 1000 »,
 * « SW1A 1AA », « 1012 AB », « 4000-123 »). Not `JOB_POSTAL_CODE_PATTERN`:
 * that one is digits only, and a carrier's file has no country to pick a
 * stricter format from.
 */
export const CONTACT_POSTAL_CODE_PATTERN = /^(?=.{3,10}$)[A-Za-z0-9]+(?:[ -][A-Za-z0-9]+)*$/;
export const isValidContactPostalCode = (raw: string) =>
  CONTACT_POSTAL_CODE_PATTERN.test(raw.trim());

/** Keeps only the last four characters, for display of a redacted IBAN/BIC. */
export const last4 = (value: string) =>
  value.replace(/\s+/g, "").slice(-4).toUpperCase();
