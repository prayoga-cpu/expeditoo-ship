/**
 * Validators for the French business and banking identifiers collected during
 * carrier onboarding (docs/specs/carrier_kyc_spec.md §3).
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
export const isValidPlate = (plate: string) =>
  PLATE_PATTERN.test(plate.toUpperCase());

/** Accepts 0X XX XX XX XX and +33 X XX XX XX XX, with or without spacing. */
export function isValidFrenchPhone(raw: string): boolean {
  const phone = raw.replace(/[\s.-]/g, "");
  return /^(?:\+33|0)[1-9]\d{8}$/.test(phone);
}

export const VAT_PATTERN = /^FR[0-9A-Z]{2}\d{9}$/;
export const POSTAL_CODE_PATTERN = /^\d{5}$/;

/** Keeps only the last four characters, for display of a redacted IBAN/BIC. */
export const last4 = (value: string) =>
  value.replace(/\s+/g, "").slice(-4).toUpperCase();
