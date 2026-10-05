import { describe, expect, it } from "vitest";

import {
  NUMERIC_RULES,
  centsToInput,
  decimalSeparatorFor,
  numberToInput,
  parseCents,
  parseDecimal,
  parseScaled,
  sanitizeNumericInput,
  tidyNumericText,
  type DecimalSeparator,
  type NumericRules,
} from "../numeric-input";

/**
 * The rule every typed number goes through (numeric_input_spec.md §3). The
 * caret is asserted beside the value throughout: a rule that cleans the text
 * but throws the caret to the end is the bug a number box already had.
 */

const { MONEY, KG, TONNES, CM, QUANTITY, COUNT } = NUMERIC_RULES;

/**
 * One edit: the box held `previous`, and now holds `raw` with the caret at
 * `caret`. `inserted` is the browser saying the edit put text in.
 */
const edit = (
  previous: string,
  raw: string,
  caret: number,
  rules: NumericRules = MONEY,
  separator: DecimalSeparator = ",",
  inserted = false
) => sanitizeNumericInput(raw, caret, rules, separator, previous, inserted);

/** Keystrokes one by one at the end of the box, as a person types them. */
function typeInto(
  keys: string,
  rules: NumericRules = MONEY,
  separator: DecimalSeparator = ","
): string {
  let box = "";
  for (const key of keys) {
    box = sanitizeNumericInput(box + key, box.length + 1, rules, separator, box).value;
  }
  return box;
}

/**
 * The §3 table. Each row is an edit as a browser makes it: `typed` replaces
 * what stood between `from` and `to` in the box — a keystroke, a paste, or ""
 * for a deletion — and the caret ends up after it; the browser says text was
 * inserted whenever something was typed. The box is written as French shows
 * it; in English every « , » it shows is a « . », before the edit and after
 * it, while what was typed stays as typed: either separator is read in either
 * language.
 */
const SPEC_TABLE = [
  // row, rules, box, from, to, typed, box after, caret after, refused
  ["zero at the start", MONEY, "40", 0, 0, "0", "40", 0, false],
  ["zero inside", MONEY, "1500", 1, 1, "0", "10500", 2, false],
  ["lone separator", MONEY, "", 0, 0, ",", "0,", 2, false],
  ["a point typed", MONEY, "40", 2, 2, ".5", "40,5", 4, false],
  ["a comma typed", MONEY, "40", 2, 2, ",5", "40,5", 4, false],
  ["seventh whole digit", MONEY, "123456", 6, 6, "7", "123456", 6, true],
  ["third decimal", MONEY, "12,34", 5, 5, "5", "12,34", 5, true],
  ["second separator", MONEY, "12,5", 1, 1, ",", "12,5", 1, true],
  ["separator deleted", MONEY, "123456,78", 6, 7, "", "123456,78", 7, true],
  ["two separators pasted over all", MONEY, "1200,50", 0, 7, "1.200,50 €", "1200,50", 7, true],
  ["separator in a count", COUNT, "12", 2, 2, ",", "12", 2, true],
  ["fourth digit of a quantity", QUANTITY, "120", 3, 3, "0", "1200", 4, false],
  ["third whole tonne digit", TONNES, "12", 2, 2, "3", "12", 2, true],
  ["French amount pasted", MONEY, "", 0, 0, "1 200,50 €", "1200,50", 7, false],
  ["grouped amount pasted", MONEY, "", 0, 0, "1.200,50 €", "", 0, true],
  ["minus pasted", MONEY, "", 0, 0, "-40", "40", 2, false],
  ["zero typed over a selection", MONEY, "2040", 0, 2, "0", "40", 0, false],
  ["zero typed over a tonne's « 10, »", TONNES, "10,05", 0, 3, "0", "5", 0, false],
] as const;

describe.each([
  ["French", ","],
  ["English", "."],
] as const)("sanitizeNumericInput — the spec's table (§3) in %s", (_language, separator) => {
  const shown = (box: string) => box.replaceAll(",", separator);

  it.each(SPEC_TABLE)(
    "%s",
    (_row, rules, box, from, to, typed, after, caretAfter, refused) => {
      const previous = shown(box);
      const raw = previous.slice(0, from) + typed + previous.slice(to);
      const caret = from + typed.length;

      expect(edit(previous, raw, caret, rules, separator, typed !== "")).toEqual({
        value: shown(after),
        caret: caretAfter,
        refused: refused || undefined,
      });
    }
  );
});

describe("sanitizeNumericInput — the owner's « 040 »", () => {
  it.each([
    ["040", "40"],
    ["00", "0"],
    ["0", "0"],
    ["0,50", "0,50"],
    ["0.5", "0,5"],
  ])("typing %j leaves %j", (keys, box) => {
    expect(typeInto(keys)).toBe(box);
  });

  it("drops every leading zero of a count", () => {
    expect(typeInto("007", COUNT)).toBe("7");
  });

  it("takes a zero typed in front of « 40 » away, caret at the start", () => {
    expect(edit("40", "040", 1)).toEqual({ value: "40", caret: 0 });
  });

  it("keeps a zero typed inside a number, caret after it", () => {
    expect(edit("1500", "10500", 2)).toEqual({ value: "10500", caret: 2 });
  });

  it("keeps the zeros a deletion exposes, until the box is left", () => {
    // « 1005 » with the « 1 » deleted still reads 5, and shows its zeros so
    // that the digit typed back in front restores the magnitude.
    expect(edit("1005", "005", 0)).toEqual({ value: "005", caret: 0 });
    expect(edit("10,5", "0,5", 0)).toEqual({ value: "0,5", caret: 0 });
  });

  it("gives « 100 » for « 200 » with its « 2 » replaced — never « 10 »", () => {
    expect(edit("200", "00", 0)).toEqual({ value: "00", caret: 0 });
    expect(edit("00", "100", 1)).toEqual({ value: "100", caret: 1 });
    expect(edit("1000", "000", 0)).toEqual({ value: "000", caret: 0 });
    expect(edit("000", "2000", 1)).toEqual({ value: "2000", caret: 1 });
  });

  it("gives « 2,5 » t for « 0,5 » with its « 0 » replaced — never « 20,5 »", () => {
    expect(edit("0,5", ",5", 0, TONNES)).toEqual({ value: ",5", caret: 0 });
    expect(edit(",5", "2,5", 1, TONNES)).toEqual({ value: "2,5", caret: 1 });
  });

  it("tidies a paste over a selection, which is not a deletion", () => {
    // Shorter than before, but with characters the box did not hold.
    expect(edit("89,90", "040", 3)).toEqual({ value: "40", caret: 2 });
    expect(edit("1500", "07", 2)).toEqual({ value: "7", caret: 1 });
  });

  // Found in review: « 0 » typed over the « 20 » of « 2040 » leaves the
  // « 040 » that deleting the « 2 » leaves, so the text alone kept the zero.
  it("tidies what the browser says was typed, even when it reads like a deletion", () => {
    expect(edit("2040", "040", 1)).toEqual({ value: "040", caret: 1 });
    expect(edit("2040", "040", 1, MONEY, ",", true)).toEqual({ value: "40", caret: 0 });
    // « 040 » pasted over all of « 1040 ».
    expect(edit("1040", "040", 3, MONEY, ",", true)).toEqual({ value: "40", caret: 2 });
    // In tonnes the zeros it kept counted as whole digits, and « 0 » typed
    // over the « 10, » of « 10,05 » was refused.
    expect(edit("10,05", "005", 1, TONNES)).toEqual({
      value: "10,05",
      caret: 3,
      refused: true,
    });
    expect(edit("10,05", "005", 1, TONNES, ",", true)).toEqual({ value: "5", caret: 0 });
  });

  it("still tidies zeros typed in front of what a deletion left", () => {
    expect(edit("00", "000", 1)).toEqual({ value: "0", caret: 0 });
    expect(edit("05", "005", 1)).toEqual({ value: "5", caret: 0 });
  });
});

describe("tidyNumericText — the box once it is left", () => {
  it.each([
    ["00", "0"],
    ["040", "40"],
    ["005", "5"],
    [",5", "0,5"],
    ["0,5", "0,5"],
    ["40", "40"],
    ["", ""],
  ])("« %s » → « %s »", (text, tidy) => {
    expect(tidyNumericText(text, MONEY, ",")).toBe(tidy);
  });

  it("writes the language's separator", () => {
    expect(tidyNumericText(",5", MONEY, ".")).toBe("0.5");
  });
});

describe("sanitizeNumericInput — the separator", () => {
  it("gives a leading separator its zero, caret after both", () => {
    expect(edit("", ",", 1)).toEqual({ value: "0,", caret: 2 });
    expect(edit("5", ",5", 1)).toEqual({ value: "0,5", caret: 2 });
  });

  it("shows « , » in French whichever was typed", () => {
    expect(edit("40", "40.5", 4)).toEqual({ value: "40,5", caret: 4 });
    expect(typeInto("1.05", TONNES)).toBe("1,05");
  });

  it("shows « . » in English whichever was typed", () => {
    expect(edit("40", "40,5", 4, MONEY, ".")).toEqual({ value: "40.5", caret: 4 });
    expect(typeInto("1,05", TONNES, ".")).toBe("1.05");
  });

  it("refuses a second separator, wherever it is typed", () => {
    const refused = { value: "12,5", refused: true };
    expect(edit("12,5", "12,5,", 5)).toEqual({ ...refused, caret: 4 });
    expect(edit("12,5", "1,2,5", 2)).toEqual({ ...refused, caret: 1 });
    expect(edit("12,5", "12,5.", 5)).toEqual({ ...refused, caret: 4 });
  });

  it("refuses any separator where no decimals are taken", () => {
    expect(edit("12", "12,", 3, COUNT)).toEqual({
      value: "12",
      caret: 2,
      refused: true,
    });
    expect(typeInto("1,5", COUNT)).toBe("15");
    expect(typeInto("1,5", QUANTITY)).toBe("15");
  });
});

describe("sanitizeNumericInput — what is not a number", () => {
  it.each([
    ["-40", "40"],
    ["+40", "40"],
    ["1e3", "13"],
    ["40€", "40"],
    ["4a0", "40"],
    ["4 0", "40"],
  ])("typing %j leaves %j", (keys, box) => {
    expect(typeInto(keys)).toBe(box);
  });

  it("reads a pasted French amount, spaces and all", () => {
    expect(edit("", "1 200,50 €", 10)).toEqual({ value: "1200,50", caret: 7 });
    // As Intl writes it: a narrow no-break space between the groups, and a
    // no-break space before the sign.
    expect(edit("", "1 200,50 €", 10).value).toBe("1200,50");
  });

  it("refuses a pasted amount with two separators rather than guess", () => {
    expect(edit("", "1.200,50 €", 10)).toEqual({
      value: "",
      caret: 0,
      refused: true,
    });
    expect(edit("40", "401.200,50", 10)).toEqual({
      value: "40",
      caret: 2,
      refused: true,
    });
  });

  it("keeps the caret after the same kept characters", () => {
    // « a » typed between the 4 and the 0 is removed, caret back between them.
    expect(edit("40", "4a0", 2)).toEqual({ value: "40", caret: 1 });
  });
});

describe("sanitizeNumericInput — limits refuse, never cut", () => {
  it.each([
    ["MONEY", MONEY, "123456", "123456,12"],
    ["KG", KG, "12345", "12345,1"],
    ["TONNES", TONNES, "12", "12,123"],
    ["CM", CM, "1234", "1234,1"],
    ["QUANTITY", QUANTITY, "99999", null],
    ["COUNT", COUNT, "123", null],
  ] as const)("%s refuses one digit too many", (_name, rules, whole, full) => {
    expect(edit(whole, `${whole}9`, whole.length + 1, rules)).toEqual({
      value: whole,
      caret: whole.length,
      refused: true,
    });
    if (full) {
      expect(edit(full, `${full}9`, full.length + 1, rules)).toEqual({
        value: full,
        caret: full.length,
        refused: true,
      });
    }
  });

  it("refuses a digit typed at the front of a full box, caret where it was", () => {
    expect(edit("123456", "7123456", 1)).toEqual({
      value: "123456",
      caret: 0,
      refused: true,
    });
  });

  it("refuses a digit in the middle rather than cut one off the end", () => {
    // Cutting would turn 123 456 € into 172 345 €.
    expect(edit("123456", "1723456", 2)).toEqual({
      value: "123456",
      caret: 1,
      refused: true,
    });
  });

  it("refuses deleting a separator that would join too many digits", () => {
    // From the lengths alone, the caret goes back after the « , » — right for
    // Backspace; after Delete the box puts back what it noted (§5.1).
    expect(edit("123456,78", "12345678", 6)).toEqual({
      value: "123456,78",
      caret: 7,
      refused: true,
    });
  });

  it("stops typing at the limit, keeping everything before it", () => {
    expect(typeInto("1234567")).toBe("123456");
    expect(typeInto("40,555")).toBe("40,55");
  });

  // On `COUNT`, a floor's three digits, « 1200 » chairs read « 120 » and were
  // posted as 120 (found in review).
  it("counts items past 999, and floors to three digits", () => {
    expect(typeInto("1200", QUANTITY)).toBe("1200");
    expect(typeInto("99999", QUANTITY)).toBe("99999");
    expect(typeInto("1200", COUNT)).toBe("120");
  });

  it("never flags an edit it takes", () => {
    expect(edit("12", "120", 3, QUANTITY).refused).toBeUndefined();
    expect(edit("", "-40", 3).refused).toBeUndefined();
  });

  it("does not count a dropped leading zero against the limit", () => {
    expect(edit("123456", "0123456", 1)).toEqual({ value: "123456", caret: 0 });
  });
});

describe("parseDecimal", () => {
  it.each([
    ["40,5", 40.5],
    ["40.5", 40.5],
    ["40,", 40],
    [",5", 0.5],
    ["0", 0],
    [" 12 ", 12],
  ])("reads %j as %d", (text, number) => {
    expect(parseDecimal(text)).toBe(number);
  });

  it.each(["", ",", "1 200", "abc", "-1", "1e3", "1,2,3"])(
    "reads %j as no number",
    (text) => {
      expect(parseDecimal(text)).toBeNull();
    }
  );
});

describe("parseScaled and parseCents", () => {
  it.each([
    ["40,05", 4005],
    ["40.05", 4005],
    ["40,5", 4050],
    ["40", 4000],
    ["40,", 4000],
    ["0,05", 5],
    [",5", 50],
  ])("reads %j as %d cents", (text, cents) => {
    expect(parseCents(text)).toBe(cents);
  });

  it("refuses more decimals than a cent has", () => {
    expect(parseCents("40,005")).toBeNull();
    expect(parseCents("")).toBeNull();
  });

  it("reads tonnes as whole kilograms, on the digits", () => {
    expect(parseScaled("1,05", 3)).toBe(1050);
    // 1.001 * 1000 is 1000.9999999999999 in floating point.
    expect(parseScaled("1,001", 3)).toBe(1001);
    expect(parseScaled("12", 0)).toBe(12);
    expect(parseScaled("1,5", 0)).toBeNull();
  });
});

describe("centsToInput", () => {
  it("writes cents in full, or not at all", () => {
    expect(centsToInput(8990, "fr")).toBe("89,90");
    expect(centsToInput(8990, "en")).toBe("89.90");
    expect(centsToInput(4000, "fr")).toBe("40");
    expect(centsToInput(4050, "fr")).toBe("40,50");
    expect(centsToInput(5, "fr")).toBe("0,05");
    expect(centsToInput(0, "fr")).toBe("0");
  });

  it("writes nothing for a figure no box could hold", () => {
    expect(centsToInput(-100, "fr")).toBe("");
    expect(centsToInput(Number.NaN, "fr")).toBe("");
  });

  it.each([0, 5, 99, 100, 4005, 8990, 10_000_000])(
    "round-trips %d cents through the box in both languages",
    (cents) => {
      for (const locale of ["fr", "en"]) {
        const text = centsToInput(cents, locale);
        expect(parseCents(text)).toBe(cents);
        // And the box leaves it as it is.
        const separator = decimalSeparatorFor(locale);
        expect(edit("", text, text.length, MONEY, separator).value).toBe(text);
      }
    }
  );
});

describe("numberToInput", () => {
  it("writes a measure to its places, trailing zeros dropped", () => {
    expect(numberToInput(45.5, 1, "fr")).toBe("45,5");
    expect(numberToInput(45.5, 1, "en")).toBe("45.5");
    expect(numberToInput(12, 1, "fr")).toBe("12");
    expect(numberToInput(1050 / 1000, 3, "fr")).toBe("1,05");
    expect(numberToInput(12.345, 1, "fr")).toBe("12,3");
  });

  it("writes nothing for a figure no box could hold", () => {
    expect(numberToInput(-1, 1, "fr")).toBe("");
    expect(numberToInput(Number.POSITIVE_INFINITY, 1, "fr")).toBe("");
  });
});

describe("decimalSeparatorFor", () => {
  it.each([
    ["fr", ","],
    ["fr-FR", ","],
    ["de", ","],
    ["en", "."],
    ["en-GB", "."],
  ])("writes %s with %j", (locale, separator) => {
    expect(decimalSeparatorFor(locale)).toBe(separator);
  });

  it("reads an unknown locale tag like English rather than throwing", () => {
    expect(decimalSeparatorFor("not a locale!")).toBe(".");
  });
});
