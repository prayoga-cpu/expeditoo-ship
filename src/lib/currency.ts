/**
 * Currency and number formatting, shared so every euro amount and every
 * plain count in the app reads the same way.
 *
 * Locale is "de-DE", not "fr-FR", despite this being a French product: the
 * ICU/CLDR data behind `fr-FR` renders the thousands separator as a narrow
 * no-break space (U+202F), which enough fonts collapse to no visible gap
 * that "189543,65 €" reads as one six-digit number. `de-DE` uses the same
 * decimal comma and trailing "€" — the only difference is a literal "."
 * for the thousands separator, e.g. "189.543,65 €" — and is a stable,
 * widely-supported locale, so it isn't at the mercy of the next CLDR update
 * changing that character again.
 */

const CURRENCY_FORMATTERS = new Map<string, Intl.NumberFormat>();

function currencyFormatter(currency: string, fractionDigits: number): Intl.NumberFormat {
  const key = `${currency}:${fractionDigits}`;
  let formatter = CURRENCY_FORMATTERS.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    CURRENCY_FORMATTERS.set(key, formatter);
  }
  return formatter;
}

/**
 * Formats a value in cents to a currency string.
 * @param cents - The monetary value in cents (e.g., 18954365 for "189.543,65 €")
 * @param options.currency - ISO 4217 code, default "EUR"
 * @param options.fractionDigits - default 2; pass 0 for whole-euro display
 */
export function formatCurrency(
  cents: number,
  options: { currency?: string; fractionDigits?: number } = {}
): string {
  const { currency = "EUR", fractionDigits = 2 } = options;
  const amount = Number.isFinite(cents) ? cents / 100 : 0;
  return currencyFormatter(currency.toUpperCase(), fractionDigits).format(amount);
}

const NUMBER_FORMATTER = new Intl.NumberFormat("de-DE");

/** Formats a plain count/quantity with the same thousands separator, e.g. 4593 -> "4.593". */
export function formatNumber(value: number): string {
  return NUMBER_FORMATTER.format(Number.isFinite(value) ? value : 0);
}

/**
 * Converts a Euro input value (e.g. from a form) to cents.
 * @param amount - The amount in Euros (e.g. 10.50)
 * @returns The amount in cents (e.g. 1050)
 */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}
