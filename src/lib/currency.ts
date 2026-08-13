/**
 * Formats a value in cents to a Euro currency string.
 * @param cents - The monetary value in cents (e.g., 1050 for €10.50)
 * @returns Formatted currency string (e.g., "€10.50")
 */
export function formatCurrency(cents: number, fractionDigits: number = 2): string {
  if (isNaN(cents)) {
      return new Intl.NumberFormat("en-IE", {
          style: "currency",
          currency: "EUR",
          minimumFractionDigits: fractionDigits,
          maximumFractionDigits: fractionDigits,
      }).format(0);
  }
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(cents / 100);
}

/**
 * Converts a Euro input value (e.g. from a form) to cents.
 * @param amount - The amount in Euros (e.g. 10.50)
 * @returns The amount in cents (e.g. 1050)
 */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}
