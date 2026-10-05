/**
 * Numbers people type — a budget, a price, a weight, a count — kept as the
 * text they typed.
 *
 * Every such box was `type="number"`, and the owner asked for the obvious:
 * type « 040 », see « 40 ». A number box cannot be tidied as it is typed. The
 * browser keeps its text from the page — `value` is "" while it shows « 1. » —
 * `selectionStart` is null, so any rewrite throws the caret to the end, and
 * React compares it loosely, so a box re-derived from a number turned « 1.0 »
 * into « 1 » and saved 1,05 t as 15 t (docs/specs/numeric_input_spec.md §1).
 *
 * So they are text boxes, and this is the rule every edit goes through (§3):
 * digits and one decimal separator, typed "," or "." and shown the language's
 * way; a lone leading zero dropped once another digit follows; anything else
 * removed; and an edit that would break a field's limits refused whole rather
 * than cut short, because cutting digits off in the middle of an amount
 * changes the amount.
 *
 * Nothing here knows React — `components/ui/numeric-input.tsx` is the box that
 * applies it — so the form schema reads typed text with the same functions.
 */

export type DecimalSeparator = "," | ".";

/** How much a box takes. Leading zeros never count: they are dropped. */
export interface NumericRules {
  /** Digits after the separator; 0 refuses a separator altogether. */
  decimals: number;
  /** Digits before it. */
  integerDigits: number;
}

/**
 * `MONEY` reaches 100 000 €, the most a budget or an offer may be
 * (`MAX_BUDGET_CENTS`, `MAX_OFFER_CENTS`); `KG` and `TONNES` both reach the
 * 44 t a lorry carries, to 100 g and to the kilogram; `CM` reaches a 13,6 m
 * trailer; `QUANTITY` reaches the 99 999 items a request may count
 * (`quantityMax`) — it shared `COUNT`, a floor's three digits, and « 1200 »
 * chairs read « 120 ». The limits stop a stray key from making an absurd
 * figure — what is too much is still the schema's to say
 * (numeric_input_spec.md §3).
 */
export const NUMERIC_RULES = {
  MONEY: { decimals: 2, integerDigits: 6 },
  KG: { decimals: 1, integerDigits: 5 },
  TONNES: { decimals: 3, integerDigits: 2 },
  CM: { decimals: 1, integerDigits: 4 },
  QUANTITY: { decimals: 0, integerDigits: 5 },
  COUNT: { decimals: 0, integerDigits: 3 },
} as const satisfies Record<string, NumericRules>;

/** A box's text after an edit, and where its caret goes. */
export interface NumericText {
  value: string;
  caret: number;
  /**
   * The edit was refused: `value` is what the box held before it, and `caret`
   * only works out where the edit began from the lengths. The box puts back
   * the exact selection instead when it noted one (§3.4, §5.1).
   */
  refused?: true;
}

/** One character kept, and its index in the text as it was typed. */
interface Kept {
  /** A digit, or "." for the decimal separator, whichever was typed. */
  char: string;
  from: number;
}

const isDigit = (char: string) => char >= "0" && char <= "9";
const isSeparator = (char: string) => char === "," || char === ".";

/**
 * Where the decimal separator was typed: -1 for none, `null` for two. Two is
 * refused rather than read: a slip of the finger into « 12,5 » would otherwise
 * move the decimal point, and in a pasted « 1.200,50 » which one is decimal
 * cannot be told without guessing.
 */
function decimalPoint(raw: string): number | null {
  let at = -1;
  for (let i = 0; i < raw.length; i++) {
    if (!isSeparator(raw[i])) continue;
    if (at !== -1) return null;
    at = i;
  }
  return at;
}

/**
 * The digits and separator worth keeping, each tagged with where it was
 * typed. `tidy` applies the leading-zero rule; without it the zeros stay as
 * they are.
 */
function keepNumeric(raw: string, point: number, tidy: boolean): Kept[] {
  const kept: Kept[] = [];
  for (let i = 0; i < raw.length; i++) {
    if (i === point) {
      // « ,5 » is « 0,5 ». The zero is tagged with the separator's index, so
      // a caret after the separator lands after both.
      if (tidy && kept.length === 0) kept.push({ char: "0", from: i });
      kept.push({ char: ".", from: i });
    } else if (isDigit(raw[i])) {
      // « 040 » is « 40 »: a whole part that is a lone zero gives way to the
      // next digit. « 0,5 » keeps its zero, being followed by a separator.
      const whole = point === -1 || i < point;
      if (tidy && whole && kept.length === 1 && kept[0].char === "0") kept.pop();
      kept.push({ char: raw[i], from: i });
    }
  }
  return kept;
}

/**
 * Whether `raw` is `previous` with characters taken out and nothing added —
 * what Backspace, Delete or a cut leaves, wherever the caret sits. The text
 * alone cannot rule out a keystroke: « 0 » typed over the « 20 » of « 2040 »
 * leaves the same « 040 » as the « 2 » deleted (`inserted`, below).
 */
function isDeletion(raw: string, previous: string): boolean {
  if (raw.length >= previous.length) return false;
  let matched = 0;
  for (const char of previous) if (char === raw[matched]) matched++;
  return matched === raw.length;
}

function fitsRules(kept: Kept[], rules: NumericRules): boolean {
  const point = kept.findIndex((k) => k.char === ".");
  if (point === -1) return kept.length <= rules.integerDigits;
  return (
    rules.decimals > 0 &&
    point <= rules.integerDigits &&
    kept.length - point - 1 <= rules.decimals
  );
}

/**
 * The box after an edit (`raw`, with the caret where the browser left it),
 * cleaned by the rule above. `previous` is what the box held before the
 * edit: a refused edit gets it back, flagged `refused`, caret where the edit
 * began — which the lengths tell for a keystroke, a paste or Backspace, and
 * not for Delete, whose caret does not move. `inserted` is the browser
 * saying the edit put text in (`InputEvent.inputType`, read by the box).
 */
export function sanitizeNumericInput(
  raw: string,
  caret: number,
  rules: NumericRules,
  separator: DecimalSeparator,
  previous: string,
  inserted = false
): NumericText {
  const point = decimalPoint(raw);
  // A deletion keeps the zeros it exposes: « 200 » with its « 2 » deleted
  // reads « 00 », so the « 1 » typed in its place gives « 100 » — tidied
  // there and then, it gave « 10 », a price ten times too small. Anything
  // typed or pasted is tidied as it lands, even when its text reads like a
  // deletion; leaving the box tidies the rest (`tidyNumericText`).
  const tidy = inserted || !isDeletion(raw, previous);
  const kept = point === null ? null : keepNumeric(raw, point, tidy);
  if (!kept || !fitsRules(kept, rules)) {
    const back = caret - (raw.length - previous.length);
    return {
      value: previous,
      caret: Math.min(Math.max(back, 0), previous.length),
      refused: true,
    };
  }
  return {
    value: kept.map((k) => (k.char === "." ? separator : k.char)).join(""),
    // After as many kept characters as stood before it — the way `SiretField`
    // keeps its caret through the spaces it inserts.
    caret: kept.filter((k) => k.from < caret).length,
  };
}

/**
 * The text tidied as if it had just been typed — what a box shows once it is
 * left: « 00 » → « 0 », « 040 » → « 40 », « ,5 » → « 0,5 ».
 */
export function tidyNumericText(
  text: string,
  rules: NumericRules,
  separator: DecimalSeparator
): string {
  return sanitizeNumericInput(text, text.length, rules, separator, text).value;
}

/** Digits around at most one separator: « 12 », « 12,5 », « 12. », « ,5 ». */
const DECIMAL_TEXT = /^(\d*)(?:[.,](\d*))?$/;

function splitDecimal(text: string): { whole: string; fraction: string } | null {
  const match = DECIMAL_TEXT.exec(text.trim());
  if (!match || (match[1] === "" && !match[2])) return null;
  return { whole: match[1], fraction: match[2] ?? "" };
}

/**
 * The number a box shows — 40.5 for « 40,5 » or « 40.5 », 40 for a « 40, »
 * still being typed — or null when it shows none.
 */
export function parseDecimal(text: string): number | null {
  const parts = splitDecimal(text);
  return parts ? Number(`${parts.whole || "0"}.${parts.fraction || "0"}`) : null;
}

/**
 * The text as a whole number of its smallest unit: cents for 2 decimals,
 * kilograms from tonnes for 3. Worked out on the digits, so « 40,05 » is 4005
 * and « 1,001 » t is 1001 kg, where a float would give 1000.9999999999999.
 * Null when there is no number, or more decimals than the unit has.
 */
export function parseScaled(text: string, decimals: number): number | null {
  const parts = splitDecimal(text);
  if (!parts || parts.fraction.length > decimals) return null;
  return (
    Number(parts.whole || "0") * 10 ** decimals +
    Number(parts.fraction.padEnd(decimals, "0") || "0")
  );
}

/** Euros as typed — « 89,90 » — in cents: 8990. */
export function parseCents(text: string): number | null {
  return parseScaled(text, 2);
}

const SEPARATORS = new Map<string, DecimalSeparator>();

/** « , » in French, « . » in English: what `Intl` writes for the locale. */
export function decimalSeparatorFor(locale: string): DecimalSeparator {
  let separator = SEPARATORS.get(locale);
  if (separator === undefined) {
    let written: string | undefined;
    try {
      written = new Intl.NumberFormat(locale)
        .formatToParts(1.5)
        .find((part) => part.type === "decimal")?.value;
    } catch {
      // An unknown locale tag reads like English rather than breaking a box.
    }
    separator = written === "," ? "," : ".";
    SEPARATORS.set(locale, separator);
  }
  return separator;
}

/** `units` hundredths (or thousandths…) written out: 8990, 2 → « 89,90 ». */
function scaledToText(
  units: number,
  decimals: number,
  separator: DecimalSeparator,
  keepZeros: boolean
): string {
  const scale = 10 ** decimals;
  const fraction = String(units % scale).padStart(decimals, "0");
  const shown = keepZeros ? fraction : fraction.replace(/0+$/, "");
  const whole = String(Math.floor(units / scale));
  return /^0*$/.test(shown) ? whole : `${whole}${separator}${shown}`;
}

/**
 * Cents as the text a money box starts from: 8990 → « 89,90 » in French,
 * 4000 → « 40 ». Cents are written in full or not at all — « 89,9 » reads as
 * a typo on a price.
 */
export function centsToInput(cents: number, locale: string): string {
  if (!Number.isFinite(cents) || cents < 0) return "";
  return scaledToText(Math.round(cents), 2, decimalSeparatorFor(locale), true);
}

/**
 * A measure as the text a box starts from, to `decimals` places with the
 * trailing zeros dropped: 45.5, 1 → « 45,5 »; 1.05, 3 → « 1,05 »; 12, 1 → « 12 ».
 */
export function numberToInput(
  value: number,
  decimals: number,
  locale: string
): string {
  if (!Number.isFinite(value) || value < 0) return "";
  const units = Math.round(value * 10 ** decimals);
  return scaledToText(units, decimals, decimalSeparatorFor(locale), false);
}
